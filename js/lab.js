/* =========================================================
   lab.js — 실험실 화면 (그리기 · 계기판 · 조작 · 미션)
   ---------------------------------------------------------
   계산은 stars.js 가 하고, 이 파일은 그것을 '보이게' 만든다.
   (EnergyKeeper · electromagnetic-induction 의 lab.js 와 같은 구조 · 같은 규칙)

   화면의 핵심 장치 네 가지
     ① **빛이 퍼지는 넓이를 격자로 그린다.** 거리가 2배가 되면 같은 빛이 4칸에 나뉜다.
        "제곱에 반비례"를 말로 외우지 않고 칸 수로 보게 하려는 것이다.
     ② 두 별을 나란히 놓고 **몇 배 밝은지 숫자로** 띄운다.
        화면 밝기는 로그로 줄여 그리므로(눈과 같다) 배수는 숫자가 맡는다.
     ③ 별을 **10 pc 로 끌어다 놓는다.** 겉보기 등급이 그 자리에서 바뀌는 것이 절대 등급이다.
     ④ 색 띠 위에 별 이름을 얹는다. 색과 표면 온도가 한 줄에서 만난다.

   ⚠ 캔버스 크기는 CSS 가 정한다. 여기서는 '보이는 크기'를 읽어 해상도만 맞춘다.
   ========================================================= */
(function () {
  "use strict";

  var S1 = window.Stars;

  /* ---------------------------------------------------------
     0. 상태
     --------------------------------------------------------- */
  var S = {
    scene: "dist",
    dist: 1.0,          // m — 전등까지의 거리
    showGrid: true,
    mag1: 1, mag2: 6,   // 등급과 밝기 장면
    starName: "시리우스",
    place: "real",      // real | std
    temp: 5800,
    mission: null, predictPick: null, missionState: "ready"
  };

  var canvas, ctx, cssW = 900, cssH = 556;
  var records = [];
  var seen = { dist2: false, dist3: false, ratio100: false, ratio25: false, moved: false, absCompared: {} };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return S1.clamp(v, a, b); }
  function star() { return S1.byName(S.starName) || S1.STARS[1]; }

  /* ---------------------------------------------------------
     1. 미션 목록
        새 미션은 이 배열에 항목만 넣으면 된다.
        판정은 checkGoal(key) 에 분기를 하나 추가한다.
     --------------------------------------------------------- */
  var MISSIONS = [
    {
      id: 1, star: "🔦", title: "2배 멀어지면?",
      story: "전등에서 <b>1 m</b> 떨어진 곳의 밝기가 <b>100</b> 이다. " +
             "<b>2 m</b> 로 멀어지면 밝기는 얼마가 될까? 예측하고 직접 옮겨 확인하자.",
      scene: "dist", setup: { dist: 1.0 }, allow: ["dist"],
      predict: { q: "거리가 2배가 되면 밝기는?", opts: ["절반인 50", "1/4인 25", "그대로 100"], ans: 1 },
      goals: [{ key: "dist2", text: "거리를 <b>2 m</b> 로 맞추고 밝기 확인하기" }],
      why: "밝기는 <b>거리의 제곱에 반비례</b>합니다. 거리가 2배가 되면 2² = 4, 즉 밝기는 <b>1/4</b>이 됩니다.<br>" +
           "화면의 격자를 보세요. 같은 빛이 <b>4칸</b>에 나뉘어 퍼졌습니다. " +
           "빛의 양은 그대로인데 넓이가 4배가 되었으니, 한 칸이 받는 빛은 4분의 1입니다."
    },
    {
      id: 2, star: "📉", title: "밝기를 9분의 1로",
      story: "이번에는 밝기를 <b>9분의 1</b>(약 11)로 만들어 보자. 거리를 얼마로 하면 될까?",
      scene: "dist", setup: { dist: 1.0 }, allow: ["dist"],
      predict: { q: "밝기가 1/9 이 되려면 거리를?", opts: ["9배", "3배", "4.5배"], ans: 1 },
      goals: [{ key: "dist3", text: "거리를 <b>3 m</b> 로 맞추기" }],
      why: "1/9 = 1/3² 이므로 거리를 <b>3배</b>로 하면 됩니다. 격자가 <b>9칸</b>이 되는 것을 확인하세요.<br>" +
           "<em>거리를 9배로 하면 밝기는 1/81 이 됩니다 — 훨씬 어두워지죠.</em>"
    },
    {
      id: 3, star: "⭐", title: "100배 밝게",
      story: "두 별의 밝기가 <b>정확히 100배</b> 차이 나게 만들어 보자. 등급을 어떻게 맞추면 될까?",
      scene: "mag", setup: { mag1: 3, mag2: 3 }, allow: ["mag1", "mag2"],
      predict: { q: "밝기가 100배 차이 나려면 등급 차이는?", opts: ["100등급", "5등급", "10등급"], ans: 1 },
      goals: [{ key: "ratio100", text: "두 별의 등급 차이를 <b>5등급</b>으로 만들기" }],
      why: "<b>1등급인 별은 6등급인 별보다 100배 밝다</b> — 이것이 등급이 정해진 방식입니다. " +
           "1과 6은 <b>5등급</b> 차이죠.<br>" +
           "그래서 <b>5등급 차이 = 100배</b>이고, 1등급 차이는 100의 다섯제곱근인 <b>약 2.5배</b>가 됩니다."
    },
    {
      id: 4, star: "🔍", title: "한 등급의 무게",
      story: "이번엔 등급 차이를 <b>1등급</b>만 만들어 보자. 밝기는 몇 배 차이일까?",
      scene: "mag", setup: { mag1: 2, mag2: 2 }, allow: ["mag1", "mag2"],
      predict: { q: "1등급 차이는 밝기로 몇 배?", opts: ["1배(차이 없음)", "약 2.5배", "20배"], ans: 1 },
      goals: [{ key: "ratio25", text: "등급 차이를 <b>1등급</b>으로 만들기" }],
      why: "<b>약 2.5배</b>입니다. 정확히는 100의 다섯제곱근(≈2.512)이에요.<br>" +
           "이 값을 다섯 번 곱하면 2.5 × 2.5 × 2.5 × 2.5 × 2.5 ≈ <b>100</b> 이 됩니다. " +
           "그래서 5등급 차이가 100배가 되는 것입니다."
    },
    {
      id: 5, star: "📏", title: "10 pc 로 옮겨라",
      story: "<b>시리우스</b>는 우리에게서 약 <b>2.6 pc</b> 밖에 안 됩니다. " +
             "이 별을 <b>10 pc</b> 로 옮기면 등급이 어떻게 될까?",
      scene: "abs", setup: { starName: "시리우스", place: "real" }, allow: ["star", "move"],
      predict: {
        q: "가까운 별을 더 멀리(10 pc) 옮기면 등급은?",
        opts: ["더 작아진다(밝아진다)", "더 커진다(어두워진다)", "변하지 않는다"], ans: 1
      },
      goals: [{ key: "moved", text: "시리우스를 <b>10 pc</b> 로 옮겨 보기" }],
      why: "멀어지면 어두워지고, 어두워지면 <b>등급은 커집니다.</b> " +
           "시리우스의 겉보기 등급은 <b>−1.5</b> 지만, 10 pc 로 옮기면 <b>약 1.4</b> 가 됩니다. " +
           "이 값이 시리우스의 <b>절대 등급</b>입니다.<br>" +
           "시리우스가 그렇게 밝게 보이는 큰 이유는 <b>가깝기 때문</b>이었어요."
    },
    {
      id: 6, star: "🌟", title: "진짜 밝은 별은?",
      story: "<b>시리우스</b>와 <b>베텔게우스</b>를 각각 10 pc 로 옮겨 보고, " +
             "<b>실제로 더 밝은 별</b>이 어느 쪽인지 알아내자.",
      scene: "abs", setup: { starName: "시리우스", place: "real" }, allow: ["star", "move"],
      predict: {
        q: "겉보기로는 시리우스가 훨씬 밝다. 10 pc 에 나란히 세우면?",
        opts: ["그래도 시리우스가 밝다", "베텔게우스가 훨씬 밝다", "둘이 똑같아진다"], ans: 1
      },
      goals: [
        { key: "abs시리우스", text: "시리우스를 10 pc 로 옮겨 절대 등급 보기" },
        { key: "abs베텔게우스", text: "베텔게우스를 10 pc 로 옮겨 절대 등급 보기" }
      ],
      why: "10 pc 에 나란히 세우면 <b>베텔게우스가 훨씬 밝습니다.</b><br>" +
           "· 시리우스 — 겉보기 −1.5 / 절대 <b>약 1.4</b> (가까워서 밝게 보였다)<br>" +
           "· 베텔게우스 — 겉보기 0.4 / 절대 <b>약 −5.7</b> (멀리 있는데도 저만큼 보인다)<br>" +
           "<b>밝게 보인다고 실제로 밝은 별은 아닙니다.</b> " +
           "그래서 별의 진짜 밝기를 견주려면 <b>같은 거리에 세워 놓고</b> 비교해야 하고, " +
           "그 약속이 <b>절대 등급(10 pc)</b> 입니다."
    }
  ];

  /* ---------------------------------------------------------
     2. 장면 · 크기
     --------------------------------------------------------- */
  function sceneKind() {
    if (S.scene === "mission") return S.mission ? S.mission.scene : "dist";
    return S.scene;
  }

  function layout() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    cssW = Math.max(320, Math.round(r.width || 900));
    cssH = Math.max(200, Math.round(r.height || cssW / 1.62));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------------------------------------------------------
     3. 그리기
     --------------------------------------------------------- */
  var COL = { ink: "#e2e8f0", faint: "#64748b", line: "#94a3b8", warm: "#fbbf24" };

  function draw() {
    if (!ctx) return;
    var g = ctx;
    var grad = g.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, "#0b1220");
    grad.addColorStop(1, "#1e293b");
    g.fillStyle = grad;
    g.fillRect(0, 0, cssW, cssH);

    var k = sceneKind();
    if (k === "dist") drawDist(g);
    else if (k === "mag") drawMag(g);
    else if (k === "abs") drawAbs(g);
    else drawColor(g);
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* 별 하나 그리기 — 등급이 작을수록 크고 밝게 */
  function drawStar(g, x, y, mag, color, maxR) {
    var glow = S1.glowOf(mag);
    var R = clamp(maxR * (0.25 + glow * 0.75), 3, maxR);
    var rg = g.createRadialGradient(x, y, 1, x, y, R * 3.2);
    rg.addColorStop(0, color);
    rg.addColorStop(0.25, hexA(color, 0.55 * glow + 0.15));
    rg.addColorStop(1, hexA(color, 0));
    g.fillStyle = rg;
    g.beginPath(); g.arc(x, y, R * 3.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
  }

  function hexA(hex, a) {
    var r = parseInt(hex.substr(1, 2), 16), gg = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    return "rgba(" + r + "," + gg + "," + b + "," + clamp(a, 0, 1) + ")";
  }

  /* ---- 장면 ① 거리와 밝기 ---- */
  function drawDist(g) {
    var d = S.dist;
    var bx = cssW * 0.13, cy = cssH * 0.47;
    var pxPerM = (cssW * 0.72) / 3.0;            // 최대 3 m 가 화면에 들어오게
    var sx = bx + d * pxPerM;
    var unit = clamp(cssH * 0.16, 26, 74);       // 1 m 일 때 빛이 덮는 정사각형의 한 변
    var half = unit * d / 2;

    /* 빛이 퍼져 나가는 원뿔 */
    g.fillStyle = "rgba(251,191,36,.10)";
    g.beginPath();
    g.moveTo(bx, cy);
    g.lineTo(sx, cy - half); g.lineTo(sx, cy + half);
    g.closePath(); g.fill();

    /* 빛을 받는 면 — 같은 빛이 넓이 d² 에 나뉜다 */
    var bright = S1.brightnessAt(d);
    var alpha = clamp(bright / S1.REF_BRIGHT * 0.55, 0.03, 0.95);
    g.fillStyle = "rgba(251,191,36," + alpha + ")";
    g.fillRect(sx, cy - half, unit * 0.34, half * 2);

    if (S.showGrid) {
      /* 1 m 일 때의 칸 크기로 격자를 그린다 → 칸 수가 곧 d² 이다 */
      g.strokeStyle = "rgba(226,232,240,.55)";
      g.lineWidth = 1.2;
      var n = Math.max(1, Math.round(d));
      var cell = (half * 2) / (d);              // 1 m 기준 칸 한 변
      for (var i = 0; i <= d + 0.001; i += 1) {
        var yy = cy - half + cell * i;
        if (yy > cy + half + 0.5) break;
        g.beginPath(); g.moveTo(sx, yy); g.lineTo(sx + unit * 0.34, yy); g.stroke();
      }
      g.strokeStyle = "rgba(226,232,240,.85)";
      g.lineWidth = 2;
      g.strokeRect(sx, cy - half, unit * 0.34, half * 2);

      /* 안내 글자는 무대 **오른쪽 위**에 고정한다.
         빛 받는 면 옆에 붙이면 거리를 최대로 밀었을 때 화면 밖으로 넘어간다. */
      g.fillStyle = COL.ink;
      g.font = "bold 15px sans-serif";
      g.textAlign = "right";
      g.fillText("빛이 퍼진 넓이 " + (d * d).toFixed(2) + " 배", cssW - 16, 28);
      g.fillStyle = COL.faint;
      g.font = "14px sans-serif";
      g.fillText("한 칸이 받는 빛은 " + (1 / (d * d)).toFixed(3) + " 배", cssW - 16, 50);
    }

    /* 전등 */
    var lg = g.createRadialGradient(bx, cy, 2, bx, cy, 46);
    lg.addColorStop(0, "rgba(253,224,71,.95)");
    lg.addColorStop(1, "rgba(253,224,71,0)");
    g.fillStyle = lg;
    g.beginPath(); g.arc(bx, cy, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fde047";
    g.beginPath(); g.arc(bx, cy, 13, 0, Math.PI * 2); g.fill();
    g.fillStyle = COL.ink;
    g.font = "bold 15px sans-serif";
    g.textAlign = "center";
    g.fillText("전등", bx, cy + 44);

    /* 거리 자 */
    g.strokeStyle = COL.line;
    g.lineWidth = 1.5;
    var ry = cssH - 40;
    g.beginPath(); g.moveTo(bx, ry); g.lineTo(sx, ry); g.stroke();
    [bx, sx].forEach(function (x) {
      g.beginPath(); g.moveTo(x, ry - 6); g.lineTo(x, ry + 6); g.stroke();
    });
    g.fillStyle = COL.ink;
    g.font = "bold 16px sans-serif";
    g.textAlign = "center";
    g.fillText(d.toFixed(1) + " m", (bx + sx) / 2, ry - 12);

    g.fillStyle = COL.warm;
    g.font = "bold 20px sans-serif";
    g.textAlign = "left";
    g.fillText("밝기 " + fmt(bright), 18, 30);
  }

  /* ---- 장면 ② 등급과 밝기 ---- */
  function drawMag(g) {
    var cy = cssH * 0.42, maxR = clamp(cssH * 0.11, 12, 46);
    var x1 = cssW * 0.28, x2 = cssW * 0.72;
    drawStar(g, x1, cy, S.mag1, "#fff4e2", maxR);
    drawStar(g, x2, cy, S.mag2, "#fff4e2", maxR);

    g.fillStyle = COL.ink;
    g.font = "bold 17px sans-serif";
    g.textAlign = "center";
    g.fillText(S.mag1.toFixed(1) + " 등급", x1, cy + maxR * 3.4);
    g.fillText(S.mag2.toFixed(1) + " 등급", x2, cy + maxR * 3.4);

    var c = S1.compare(S.mag1, S.mag2);
    g.fillStyle = COL.warm;
    g.font = "bold 22px sans-serif";
    var msg = (c.magDiff < 0.001)
      ? "두 별의 밝기가 같다"
      : ((c.brighter === 1 ? "왼쪽" : "오른쪽") + " 별이 " + fmt(c.ratio) + " 배 밝다");
    g.fillText(msg, cssW / 2, cssH * 0.80);
    g.fillStyle = COL.faint;
    g.font = "16px sans-serif";
    g.fillText("등급 차이 " + c.magDiff.toFixed(1) + " 등급", cssW / 2, cssH * 0.80 + 26);

    g.fillStyle = COL.faint;
    g.font = "14px sans-serif";
    g.textAlign = "left";
    g.fillText("등급이 작을수록 밝다 · 1등급 차 ≈ 2.5배 · 5등급 차 = 100배", 18, 26);
  }

  /* ---- 장면 ③ 겉보기 등급과 절대 등급 ---- */
  function drawAbs(g) {
    var st = S1.info(star());
    var atStd = (S.place === "std");
    var d = atStd ? S1.STD_DIST : st.d;
    var mag = atStd ? st.M : st.m;

    /* 거리 축 (로그) — 0.1 pc ~ 1000 pc */
    var ax = cssW * 0.10, aw = cssW * 0.80, ay = cssH * 0.72;
    g.strokeStyle = COL.line; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax + aw, ay); g.stroke();

    function xOf(pc) {
      var t = (S1.log10(clamp(pc, 0.1, 1000)) + 1) / 4;     // log10 0.1→-1 … 1000→3
      return ax + aw * clamp(t, 0, 1);
    }
    [0.1, 1, 10, 100, 1000].forEach(function (pc) {
      var x = xOf(pc);
      g.strokeStyle = (pc === 10) ? "#38bdf8" : COL.line;
      g.lineWidth = (pc === 10) ? 3 : 1.5;
      g.beginPath(); g.moveTo(x, ay - 8); g.lineTo(x, ay + 8); g.stroke();
      g.fillStyle = (pc === 10) ? "#7dd3fc" : COL.faint;
      g.font = (pc === 10) ? "bold 14px sans-serif" : "13px sans-serif";
      g.textAlign = "center";
      g.fillText(pc + " pc", x, ay + 26);
    });
    g.fillStyle = "#7dd3fc";
    g.font = "bold 13px sans-serif";
    g.fillText("절대 등급의 기준", xOf(10), ay + 44);

    /* 지구(관측자) */
    g.fillStyle = "#38bdf8";
    g.beginPath(); g.arc(ax, ay, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = COL.faint;
    g.font = "13px sans-serif";
    g.textAlign = "left";
    g.fillText("지구", ax - 8, ay - 16);

    /* 별 */
    var sx = xOf(d), sy = cssH * 0.36;
    g.strokeStyle = "rgba(148,163,184,.45)";
    g.setLineDash([5, 5]); g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(sx, sy + 30); g.lineTo(sx, ay - 10); g.stroke();
    g.setLineDash([]);
    drawStar(g, sx, sy, mag, st.color, clamp(cssH * 0.10, 10, 40));

    g.fillStyle = COL.ink;
    g.font = "bold 18px sans-serif";
    g.textAlign = "center";
    g.fillText(st.name, sx, sy - clamp(cssH * 0.10, 10, 40) * 2.2);

    /* 등급 상자 */
    var bw = Math.min(330, cssW * 0.42), bx = 18, by = 16;
    g.fillStyle = "rgba(15,23,42,.72)";
    g.strokeStyle = "rgba(148,163,184,.45)"; g.lineWidth = 1.5;
    roundRect(g, bx, by, bw, 92, 10); g.fill(); g.stroke();
    g.textAlign = "left";
    g.fillStyle = atStd ? COL.faint : "#fde047";
    g.font = "bold 16px sans-serif";
    g.fillText("겉보기 등급  " + st.m.toFixed(2), bx + 14, by + 28);
    g.fillStyle = atStd ? "#fde047" : COL.faint;
    g.fillText("절대 등급    " + st.M.toFixed(2), bx + 14, by + 52);
    g.fillStyle = COL.ink;
    g.font = "14px sans-serif";
    g.fillText("실제 거리 " + fmtDist(st.d) + " (" + fmt(st.ly) + " 광년)", bx + 14, by + 76);

    /* 지금 어느 쪽을 보고 있는지 */
    g.fillStyle = COL.warm;
    g.font = "bold 17px sans-serif";
    g.textAlign = "center";
    g.fillText(atStd ? "📏 10 pc 에 옮겨 놓았다 → 지금 보이는 등급이 절대 등급"
                     : "🌍 실제 거리에서 본 모습 → 지금 보이는 등급이 겉보기 등급",
               cssW / 2, cssH - 16);
  }

  /* ---- 장면 ④ 색과 표면 온도 ---- */
  function drawColor(g) {
    var t = S.temp;
    var cx = cssW * 0.5, cy = cssH * 0.32;
    drawStar(g, cx, cy, 0.5, S1.colorOf(t), clamp(cssH * 0.13, 16, 54));

    g.fillStyle = COL.ink;
    g.font = "bold 22px sans-serif";
    g.textAlign = "center";
    g.fillText(S1.colorName(t) + " · " + t.toLocaleString() + " K", cx, cy + clamp(cssH * 0.13, 16, 54) * 3 + 10);

    /* 색 띠 — 학습지의 차례 그대로 (뜨거운 청색 → 차가운 적색) */
    var bx = cssW * 0.08, bw = cssW * 0.84, by = cssH * 0.66, bh = clamp(cssH * 0.10, 22, 44);
    var grad = g.createLinearGradient(bx, 0, bx + bw, 0);
    S1.COLOR_STEPS.forEach(function (c, i) {
      grad.addColorStop(i / (S1.COLOR_STEPS.length - 1), c.css);
    });
    g.fillStyle = grad;
    roundRect(g, bx, by, bw, bh, 8); g.fill();

    g.font = "13px sans-serif";
    g.textAlign = "center";
    S1.COLOR_STEPS.forEach(function (c, i) {
      var x = bx + bw * i / (S1.COLOR_STEPS.length - 1);
      g.fillStyle = COL.ink;
      g.fillText(c.name, x, by + bh + 20);
      g.fillStyle = COL.faint;
      g.fillText(c.temp.toLocaleString() + "K", x, by + bh + 38);
    });

    /* 지금 온도 표시 */
    var tt = 1 - (S1.log10(t) - S1.log10(3000)) / (S1.log10(25000) - S1.log10(3000));
    var mx = bx + bw * clamp(tt, 0, 1);
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(mx, by - 4); g.lineTo(mx - 7, by - 16); g.lineTo(mx + 7, by - 16);
    g.closePath(); g.fill();

    /* 실제 별 몇 개를 띠 위에 얹는다 */
    g.font = "12px sans-serif";
    ["베텔게우스", "태양", "시리우스", "스피카"].forEach(function (nm) {
      var s = S1.byName(nm); if (!s) return;
      var p = 1 - (S1.log10(s.temp) - S1.log10(3000)) / (S1.log10(25000) - S1.log10(3000));
      var x = bx + bw * clamp(p, 0, 1);
      g.fillStyle = "rgba(226,232,240,.85)";
      g.beginPath(); g.arc(x, by - 26, 4, 0, Math.PI * 2); g.fill();
      g.fillText(nm, x, by - 34);
    });

    g.fillStyle = COL.faint;
    g.font = "14px sans-serif";
    g.textAlign = "left";
    g.fillText("표면 온도가 높을수록 청색, 낮을수록 적색", 18, 26);
  }

  function fmt(v) {
    if (v >= 1000) return Math.round(v).toLocaleString();
    if (v >= 100) return v.toFixed(0);
    if (v >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }
  function fmtDist(pc) {
    if (pc < 0.001) return (pc * 206265).toFixed(0) + " AU";
    return fmt(pc) + " pc";
  }

  /* ---------------------------------------------------------
     4. 계기판
     --------------------------------------------------------- */
  function setBar(id, val, full) {
    var t = $(id);
    t.querySelector(".bar-fill").style.width = clamp(val / full * 100, 0, 100) + "%";
    return t;
  }
  function barText(id, txt) { $(id).querySelector(".bar-val").textContent = txt; }
  function ro(i, name, val, unit) {
    $("roName" + i).textContent = name;
    $("roVal" + i).textContent = val;
    $("roUnit" + i).textContent = unit || "";
  }

  function updatePanel() {
    var k = sceneKind();

    if (k === "dist") {
      var b = S1.brightnessAt(S.dist);
      $("gaugeTitle").textContent = "💡 밝기";
      $("gaugeSub").innerHTML = "거리를 바꾸면 밝기가 어떻게 변할까";
      $("barName1").textContent = "밝기";
      $("rowB").classList.add("hidden");
      setBar("barA", b, 400); barText("barA", fmt(b));
      ro(1, "거리", S.dist.toFixed(1), " m");
      ro(2, "밝기(상댓값)", fmt(b), "");
      ro(3, "퍼진 넓이", (S.dist * S.dist).toFixed(2), " 배");
      ro(4, "1 m 일 때 대비", (1 / (S.dist * S.dist)).toFixed(3), " 배");
      $("fLaw").innerHTML = '밝기 = <span class="t">100</span> ÷ 거리<sup>2</sup> = 100 ÷ ' +
                            S.dist.toFixed(1) + '<sup>2</sup> = <span class="k">' + fmt(b) + '</span>';
      $("fWhy").innerHTML = '<em>같은 빛이 ' + (S.dist * S.dist).toFixed(2) +
                            ' 배 넓은 곳에 퍼졌다 → 한 칸이 받는 빛은 그만큼 줄어든다</em>';
      $("graphTitle").textContent = "📈 거리에 따른 밝기";
      $("graphSub").innerHTML = "거리가 2배면 밝기는 <b>1/4</b>";

    } else if (k === "mag") {
      var c = S1.compare(S.mag1, S.mag2);
      $("gaugeTitle").textContent = "⭐ 밝기 비교";
      $("gaugeSub").innerHTML = "등급이 <b>작을수록</b> 밝다";
      $("barName1").textContent = "왼쪽";
      $("barName2").textContent = "오른쪽";
      $("rowB").classList.remove("hidden");
      var b1 = S1.ratioFromMagDiff(7 - S.mag1), b2 = S1.ratioFromMagDiff(7 - S.mag2);
      var full = Math.max(b1, b2);
      setBar("barA", b1, full); barText("barA", S.mag1.toFixed(1) + " 등급");
      setBar("barB", b2, full); barText("barB", S.mag2.toFixed(1) + " 등급");
      ro(1, "왼쪽 등급", S.mag1.toFixed(1), "");
      ro(2, "오른쪽 등급", S.mag2.toFixed(1), "");
      ro(3, "등급 차이", c.magDiff.toFixed(1), " 등급");
      ro(4, "밝기 차이", fmt(c.ratio), " 배");
      $("fLaw").innerHTML = '밝기 비 = <span class="t">100</span><sup>(등급 차 ÷ 5)</sup> = 100<sup>(' +
                            c.magDiff.toFixed(1) + ' ÷ 5)</sup> = <span class="k">' + fmt(c.ratio) + '</span> 배';
      $("fWhy").innerHTML = (c.magDiff < 0.001)
        ? '<em>등급이 같으면 밝기도 같다</em>'
        : '<em>' + (c.brighter === 1 ? '왼쪽' : '오른쪽') + ' 별이 더 밝다 — 등급이 더 작으니까</em>';
      $("graphTitle").textContent = "📈 등급 차이와 밝기 비";
      $("graphSub").innerHTML = "1등급마다 <b>약 2.5배</b>씩";

    } else if (k === "abs") {
      var st = S1.info(star());
      var atStd = (S.place === "std");
      $("gaugeTitle").textContent = "📏 겉보기 등급과 절대 등급";
      $("gaugeSub").innerHTML = "10 pc 에 옮겨 놓으면?";
      $("barName1").textContent = "겉보기";
      $("barName2").textContent = "절대";
      $("rowB").classList.remove("hidden");
      var ba = S1.ratioFromMagDiff(7 - st.m), bb = S1.ratioFromMagDiff(7 - st.M);
      var f2 = Math.max(ba, bb);
      setBar("barA", ba, f2); barText("barA", st.m.toFixed(2));
      setBar("barB", bb, f2); barText("barB", st.M.toFixed(2));
      ro(1, "겉보기 등급", st.m.toFixed(2), "");
      ro(2, "절대 등급", st.M.toFixed(2), "");
      ro(3, "거리", fmtDist(st.d), "");
      ro(4, "겉보기 − 절대", (st.m - st.M).toFixed(2), "");
      $("fLaw").innerHTML = '절대 등급 = 겉보기 − 5 log(거리 ÷ 10) = <span class="k">' + st.M.toFixed(2) + '</span>';
      $("fWhy").innerHTML = st.nearer
        ? '<em>겉보기가 절대보다 <b>작다</b> → 이 별은 <b>10 pc 보다 가깝다</b></em>'
        : (Math.abs(st.d - 10) < 0.05
            ? '<em>딱 10 pc — 겉보기와 절대가 같다</em>'
            : '<em>겉보기가 절대보다 <b>크다</b> → 이 별은 <b>10 pc 보다 멀다</b></em>');
      $("graphTitle").textContent = "📈 별들의 겉보기 · 절대 등급";
      $("graphSub").innerHTML = "가로가 <b>겉보기</b>, 세로가 <b>절대</b>";

    } else {
      $("gaugeTitle").textContent = "🌈 색과 표면 온도";
      $("gaugeSub").innerHTML = "뜨거울수록 <b>청색</b>, 차가울수록 <b>적색</b>";
      $("barName1").textContent = "표면 온도";
      $("rowB").classList.add("hidden");
      setBar("barA", S.temp, 25000); barText("barA", S.temp.toLocaleString() + " K");
      ro(1, "표면 온도", S.temp.toLocaleString(), " K");
      ro(2, "색", S1.colorName(S.temp), "");
      var s3 = S1.info(star());
      ro(3, "고른 별", s3.name, "");
      ro(4, "그 별의 온도", s3.temp.toLocaleString(), " K");
      $("fLaw").innerHTML = '지금 색 : <span class="k">' + S1.colorName(S.temp) + '</span> (' +
                            S.temp.toLocaleString() + ' K)';
      $("fWhy").innerHTML = '<em>청색 · 청백색 · 백색 · 황백색 · 황색 · 주황색 · 적색 순으로 온도가 낮아진다</em>';
      $("graphTitle").textContent = "📈 별의 색과 온도";
      $("graphSub").innerHTML = "이름난 별들의 자리";
    }

    $("tip").textContent = tipText();
    syncMissionGoals();
  }

  function tipText() {
    var k = sceneKind();
    if (k === "dist") return "거리를 밀어 보세요 — 격자 칸 수가 곧 넓이입니다";
    if (k === "mag") return "두 별의 등급을 바꿔 보세요";
    if (k === "abs") return "별을 고르고 10 pc 로 옮겨 보세요";
    return "표면 온도를 밀어 보세요";
  }

  /* ---------------------------------------------------------
     5. 그래프
     --------------------------------------------------------- */
  function drawGraph() {
    var c = $("graph");
    if (!c) return;
    var r = c.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(200, Math.round(r.width)), h = Math.max(100, Math.round(r.height));
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    var k = sceneKind(), pad = 26;

    if (k === "dist") {
      g.strokeStyle = "#cbd5e1"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - 6, h - pad); g.moveTo(pad, 6); g.lineTo(pad, h - pad); g.stroke();
      g.strokeStyle = "#f59e0b"; g.lineWidth = 2.5;
      g.beginPath();
      for (var i = 0; i <= 60; i++) {
        var d = 0.3 + (3 - 0.3) * i / 60;
        var x = pad + (w - pad - 6) * (d - 0.3) / 2.7;
        var y = (h - pad) - (h - pad - 6) * clamp(S1.brightnessAt(d) / 400, 0, 1);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      var dx = pad + (w - pad - 6) * (S.dist - 0.3) / 2.7;
      var dy = (h - pad) - (h - pad - 6) * clamp(S1.brightnessAt(S.dist) / 400, 0, 1);
      g.fillStyle = "#dc2626";
      g.beginPath(); g.arc(dx, dy, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "center";
      g.fillText("거리(m)", w / 2, h - 6);

    } else if (k === "mag") {
      g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "center";
      var diffs = [0, 1, 2, 3, 4, 5];
      var bw = (w - pad * 2) / diffs.length;
      diffs.forEach(function (dm, i) {
        var ratio = S1.ratioFromMagDiff(dm);
        var bh = (h - 40) * clamp(S1.log10(ratio) / 2, 0.02, 1);
        var x = pad + bw * i + bw * 0.15;
        var cur = Math.abs(Math.abs(S.mag1 - S.mag2) - dm) < 0.26;
        g.fillStyle = cur ? "#dc2626" : "#fcd34d";
        g.fillRect(x, h - 24 - bh, bw * 0.7, bh);
        g.fillStyle = "#334155";
        g.fillText(dm + "등급", x + bw * 0.35, h - 8);
        g.fillText(fmt(ratio) + "배", x + bw * 0.35, h - 30 - bh);
      });

    } else if (k === "abs") {
      g.strokeStyle = "#cbd5e1"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - 6, h - pad); g.moveTo(pad, 6); g.lineTo(pad, h - pad); g.stroke();
      var cur2 = star();
      S1.STARS.forEach(function (s) {
        if (s.name === "태양") return;                      // 겉보기 −26.7 이라 축이 망가진다
        var inf = S1.info(s);
        var x = pad + (w - pad - 10) * clamp((inf.m + 2) / 6, 0, 1);
        var y = (h - pad) - (h - pad - 10) * clamp((inf.M + 8) / 16, 0, 1);
        var on = (s.name === cur2.name);
        g.fillStyle = on ? "#dc2626" : "#94a3b8";
        g.beginPath(); g.arc(x, y, on ? 6 : 4, 0, Math.PI * 2); g.fill();
        if (on) {
          g.fillStyle = "#dc2626"; g.font = "bold 12px sans-serif"; g.textAlign = "center";
          g.fillText(s.name, x, y - 10);
        }
      });
      g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "center";
      g.fillText("겉보기 등급 →", w / 2, h - 6);
      g.save(); g.translate(10, h / 2); g.rotate(-Math.PI / 2);
      g.fillText("← 절대 등급", 0, 0); g.restore();

    } else {
      S1.STARS.forEach(function (s) {
        var p = 1 - (S1.log10(s.temp) - S1.log10(3000)) / (S1.log10(25000) - S1.log10(3000));
        var x = 10 + (w - 20) * clamp(p, 0, 1);
        var y = h * 0.45;
        g.fillStyle = S1.colorOf(s.temp);
        g.strokeStyle = "#94a3b8"; g.lineWidth = 1;
        g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); g.stroke();
      });
      g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "left";
      g.fillText("← 뜨겁다(청색)", 8, h - 8);
      g.textAlign = "right";
      g.fillText("차갑다(적색) →", w - 8, h - 8);
    }
  }

  /* ---------------------------------------------------------
     6. 조작 패널
     --------------------------------------------------------- */
  function syncControls() {
    var k = sceneKind();
    var allow = (S.scene === "mission" && S.mission) ? S.mission.allow : null;
    document.querySelectorAll("[data-for]").forEach(function (el) {
      var scenes = el.getAttribute("data-for").split(/\s+/);
      var need = el.getAttribute("data-need");
      var okScene = scenes.indexOf(S.scene) >= 0 || scenes.indexOf(k) >= 0;
      var okNeed = true;
      if (S.scene === "mission" && need) okNeed = allow && allow.indexOf(need) >= 0;
      el.classList.toggle("hidden", !(okScene && okNeed));
    });
    $("missionCard").classList.toggle("hidden", S.scene !== "mission");
    $("valDist").textContent = S.dist.toFixed(1) + " m";
    $("valMag1").textContent = S.mag1.toFixed(1) + " 등급";
    $("valMag2").textContent = S.mag2.toFixed(1) + " 등급";
    $("valTemp").textContent = S.temp.toLocaleString() + " K";
  }

  function setChips(id, val) {
    var w = $(id); if (!w) return;
    w.querySelectorAll(".chip").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-val") === String(val));
    });
  }

  /* ---------------------------------------------------------
     7. 미션
     --------------------------------------------------------- */
  function loadProgress() {
    try { return JSON.parse(sessionStorage.getItem("br_missions") || "[]"); } catch (e) { return []; }
  }
  function saveProgress(l) { try { sessionStorage.setItem("br_missions", JSON.stringify(l)); } catch (e) {} }

  function renderMissionList() {
    var done = loadProgress(), host = $("missionList");
    host.innerHTML = "";
    MISSIONS.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcard" + (S.mission && S.mission.id === M.id ? " on" : "") +
                    (done.indexOf(M.id) >= 0 ? " done" : "");
      b.innerHTML = '<span class="mno">미션 ' + M.id + (done.indexOf(M.id) >= 0 ? " ✅" : "") + '</span>' +
                    '<span class="mtitle"><span class="mstar">' + M.star + '</span> ' + M.title + '</span>';
      b.addEventListener("click", function () { pickMission(M); });
      host.appendChild(b);
    });
    $("missionScore").textContent = done.length + " / " + MISSIONS.length;
  }

  function pickMission(M) {
    /* 미션마다 쓰는 장면이 다르므로 장면부터 반드시 맞춘다 */
    S.scene = "mission";
    $("scenes").querySelectorAll(".scene-btn").forEach(function (x) {
      x.classList.toggle("on", x.getAttribute("data-scene") === "mission");
    });
    S.mission = M; S.predictPick = null;
    S.missionState = M.predict ? "predict" : "ready";
    var st = M.setup || {};
    Object.keys(st).forEach(function (kk) { S[kk] = st[kk]; });
    seen = { dist2: false, dist3: false, ratio100: false, ratio25: false, moved: false, absCompared: {} };

    $("rngDist").value = S.dist; $("rngMag1").value = S.mag1; $("rngMag2").value = S.mag2;
    $("rngTemp").value = S.temp; $("selStar").value = S.starName;
    setChips("chipPlace", S.place);
    syncControls(); renderMissionList(); renderMissionBody(); refresh();
  }

  function renderMissionBody() {
    var M = S.mission, body = $("missionBody");
    if (!M) { body.classList.add("hidden"); return; }
    body.classList.remove("hidden");
    $("mTitle").textContent = M.star + " 미션 " + M.id + " · " + M.title;
    $("mStory").innerHTML = M.story;

    var pd = $("mPredict");
    if (M.predict && S.missionState === "predict") {
      pd.classList.remove("hidden");
      $("mQ").innerHTML = M.predict.q;
      var opts = $("mOpts"); opts.innerHTML = "";
      M.predict.opts.forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "opt"; b.innerHTML = t;
        b.addEventListener("click", function () {
          S.predictPick = i; S.missionState = "ready"; renderMissionBody();
        });
        opts.appendChild(b);
      });
    } else pd.classList.add("hidden");

    var gl = $("mGoals");
    if (M.goals && S.missionState !== "predict") {
      gl.classList.remove("hidden");
      gl.innerHTML = '<div class="q">목표</div>' + M.goals.map(function (gg) {
        var ok = checkGoal(gg.key);
        return '<div class="goal' + (ok ? " ok" : "") + '">' + (ok ? "✅ " : "⬜ ") + gg.text + '</div>';
      }).join("");
    } else gl.classList.add("hidden");

    var vd = $("mVerdict");
    if (S.missionState === "won") {
      vd.className = "verdict ok";
      vd.innerHTML = "<b>🎉 성공!</b>" + M.why +
        (M.predict && S.predictPick != null
          ? "<br><br>" + (S.predictPick === M.predict.ans
              ? "예측도 <b>맞았습니다.</b> 잘했어요!"
              : "예측은 달랐지만 <b>직접 확인해서 알아냈습니다.</b> 그것이 더 중요해요.")
          : "");
      vd.classList.remove("hidden");
    } else if (S.missionState === "predict") vd.classList.add("hidden");
    else {
      vd.className = "verdict no";
      vd.innerHTML = "<b>직접 확인하세요</b>목표를 모두 채우면 이유가 열립니다.";
      vd.classList.remove("hidden");
    }
  }

  /* 목표 판정 — 새 목표를 만들면 여기에 분기를 하나 넣는다 */
  function checkGoal(key) {
    if (key.indexOf("abs") === 0) return !!seen.absCompared[key.slice(3)];
    switch (key) {
      case "dist2": return seen.dist2;
      case "dist3": return seen.dist3;
      case "ratio100": return seen.ratio100;
      case "ratio25": return seen.ratio25;
      case "moved": return seen.moved;
      default: return false;
    }
  }

  /* 지금 화면 상태를 보고 '본 것'을 쌓는다 */
  function noteSeen() {
    var k = sceneKind();
    if (k === "dist") {
      if (Math.abs(S.dist - 2) < 0.051) seen.dist2 = true;
      if (Math.abs(S.dist - 3) < 0.051) seen.dist3 = true;
    } else if (k === "mag") {
      var dm = Math.abs(S.mag1 - S.mag2);
      if (Math.abs(dm - 5) < 0.01) seen.ratio100 = true;
      if (Math.abs(dm - 1) < 0.01) seen.ratio25 = true;
    } else if (k === "abs") {
      if (S.place === "std") { seen.moved = true; seen.absCompared[S.starName] = true; }
    }
  }

  function syncMissionGoals() {
    if (S.scene !== "mission" || !S.mission || S.missionState === "predict") return;
    var M = S.mission;
    if (!M.goals) return;
    var all = M.goals.every(function (gg) { return checkGoal(gg.key); });
    if (all && S.missionState !== "won") {
      S.missionState = "won";
      var done = loadProgress();
      if (done.indexOf(M.id) < 0) { done.push(M.id); saveProgress(done); }
      renderMissionList(); renderMissionBody();
    } else if (S.missionState !== "won") {
      var gl = $("mGoals");
      if (!gl.classList.contains("hidden")) {
        var rows = gl.querySelectorAll(".goal");
        M.goals.forEach(function (gg, i) {
          if (!rows[i]) return;
          var ok = checkGoal(gg.key);
          rows[i].className = "goal" + (ok ? " ok" : "");
          rows[i].innerHTML = (ok ? "✅ " : "⬜ ") + gg.text;
        });
      }
    }
  }

  /* ---------------------------------------------------------
     8. 실험 기록
     --------------------------------------------------------- */
  function addRecord() {
    var k = sceneKind(), r;
    if (k === "dist") {
      r = { scene: "거리와 밝기", who: "전등", dist: S.dist.toFixed(1) + " m",
            bright: fmt(S1.brightnessAt(S.dist)), mag: "-" };
    } else if (k === "mag") {
      var c = S1.compare(S.mag1, S.mag2);
      r = { scene: "등급과 밝기", who: "두 별", dist: "-",
            bright: fmt(c.ratio) + " 배", mag: S.mag1.toFixed(1) + " / " + S.mag2.toFixed(1) };
    } else if (k === "abs") {
      var st = S1.info(star());
      r = { scene: "겉보기·절대", who: st.name, dist: fmtDist(st.d),
            bright: "-", mag: "겉 " + st.m.toFixed(2) + " / 절 " + st.M.toFixed(2) };
    } else {
      r = { scene: "색과 온도", who: S1.colorName(S.temp), dist: "-",
            bright: S.temp.toLocaleString() + " K", mag: "-" };
    }
    records.push(r);
    renderRecords();
    window.PdfKit.toast("기록했습니다. (" + records.length + "번째)", "ok");
  }

  function renderRecords() {
    var body = $("recBody");
    body.innerHTML = "";
    records.forEach(function (r, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + r.scene + "</td><td>" + r.who +
                     "</td><td>" + r.dist + "</td><td><b>" + r.bright + "</b></td><td>" + r.mag + "</td>";
      body.appendChild(tr);
    });
    $("recEmpty").classList.toggle("hidden", records.length > 0);
  }

  /* ---------------------------------------------------------
     9. 다시 그리기 — 애니메이션이 없는 앱이라 값이 바뀔 때만 그린다
        (rAF 로 계속 돌릴 이유가 없다. 탭이 숨어 있어도 화면이 남는다)
     --------------------------------------------------------- */
  function refresh() {
    noteSeen();
    draw();
    updatePanel();
    drawGraph();
  }

  /* ---------------------------------------------------------
     10. 연결
     --------------------------------------------------------- */
  function bindChips(id, fn) {
    var w = $(id); if (!w) return;
    w.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".chip") : null;
      if (!b) return;
      w.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      fn(b.getAttribute("data-val"));
    });
  }
  function range(id, fn) {
    var el = $(id);
    if (el) el.addEventListener("input", function () { fn(parseFloat(el.value)); });
  }

  function bind() {
    $("scenes").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".scene-btn") : null;
      if (!b) return;
      $("scenes").querySelectorAll(".scene-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      S.scene = b.getAttribute("data-scene");
      if (S.scene === "mission" && !S.mission) pickMission(MISSIONS[0]);
      else { syncControls(); refresh(); }
      renderMissionList();
    });

    $("btnReset").addEventListener("click", function () {
      S.dist = 1.0; S.mag1 = 1; S.mag2 = 6; S.place = "real"; S.temp = 5800;
      $("rngDist").value = 1; $("rngMag1").value = 1; $("rngMag2").value = 6; $("rngTemp").value = 5800;
      setChips("chipPlace", "real");
      syncControls(); refresh();
    });
    $("btnRecord").addEventListener("click", addRecord);
    $("btnClearRec").addEventListener("click", function () {
      if (!records.length) return;
      if (!confirm("기록을 모두 지울까요?")) return;
      records.length = 0; renderRecords();
    });

    range("rngDist", function (v) { S.dist = v; syncControls(); refresh(); });
    range("rngMag1", function (v) { S.mag1 = v; syncControls(); refresh(); });
    range("rngMag2", function (v) { S.mag2 = v; syncControls(); refresh(); });
    range("rngTemp", function (v) { S.temp = v; syncControls(); refresh(); });

    bindChips("chipGrid", function (v) { S.showGrid = (v === "on"); refresh(); });
    bindChips("chipPlace", function (v) { S.place = v; refresh(); });

    var sel = $("selStar");
    S1.STARS.forEach(function (s) {
      var o = document.createElement("option");
      o.value = s.name; o.textContent = s.name + " (" + s.note + ")";
      sel.appendChild(o);
    });
    sel.value = S.starName;
    sel.addEventListener("change", function () {
      S.starName = sel.value;
      S.temp = S1.byName(S.starName).temp;
      $("rngTemp").value = S.temp;
      syncControls(); refresh();
    });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { layout(); draw(); drawGraph(); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { layout(); draw(); drawGraph(); });
    }
  }

  function boot() {
    canvas = $("stage");
    layout();
    bind();
    syncControls();
    renderMissionList();
    renderRecords();
    refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* _test 는 검사용 손잡이다 — 화면 없이도 값과 판정을 직접 확인할 수 있다 */
  window.BrightLab = {
    S: S, MISSIONS: MISSIONS,
    _test: {
      set: function (k, v) { S[k] = v; syncControls(); refresh(); },
      scene: function (n) { S.scene = n; syncControls(); refresh(); },
      pick: function (id) { pickMission(MISSIONS[id - 1]); },
      answer: function (i) { S.predictPick = i; S.missionState = "ready"; renderMissionBody(); refresh(); },
      goals: function () {
        if (!S.mission || !S.mission.goals) return null;
        return S.mission.goals.map(function (gg) { return [gg.key, checkGoal(gg.key)]; });
      },
      state: function () { return S.missionState; },
      records: function () { return records; },
      draw: function () { draw(); return true; }
    }
  };
})();
