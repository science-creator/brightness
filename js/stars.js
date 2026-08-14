/* =========================================================
   stars.js — 별의 밝기와 등급 계산 엔진
   ---------------------------------------------------------
   이 파일은 화면을 전혀 모른다. 숫자만 만든다.
   (EnergyKeeper 의 physics.js · electromagnetic-induction 의 induction.js 와 같은 역할)

   ⚠ ES 모듈(import/export)을 쓰지 않는다.
     index.html 을 더블클릭(file://)해서 열어도 동작해야 하기 때문이다.

   ---------------------------------------------------------
   엔진의 핵심 아이디어 — 여기를 고칠 사람은 반드시 읽을 것
   ---------------------------------------------------------

   1. "거리와 밝기"와 "등급"을 **같은 밝기 값**으로 이어 붙인다

      학생이 가장 많이 놓치는 것은 이 둘이 **따로 노는 규칙이 아니라는 점**이다.
        · 거리가 2배 멀어지면 밝기는 1/4      (밝기 ∝ 1 ÷ 거리²)
        · 밝기가 100배면 등급은 5등급 차      (등급 = −2.5 log₁₀ 밝기)
      이 앱은 두 화면이 **같은 `brightness` 값**을 주고받게 해서,
      "멀어졌다 → 어두워졌다 → 그래서 등급이 커졌다"가 한 줄로 이어지게 했다.

   2. 절대 등급은 **저장하지 않고 매번 계산한다**

      별마다 겉보기 등급 m 과 거리 d(pc) 만 표에 담고,
      절대 등급은 `M = m − 5 log₁₀(d ÷ 10)` 로 그때그때 구한다.
      → 표에 M 을 따로 적어 두면 m·d 와 어긋난 값이 섞여 들어간다(실제로 교과서마다 다르다).
        계산해서 쓰면 **세 값이 언제나 서로 맞는다.** 이 앱의 3번 장면이 통째로 그 관계를 보여 주므로
        여기서 어긋나면 화면이 거짓말을 하게 된다.

   3. 눈에 보이는 밝기는 **로그로 줄여서** 그린다

      1등급과 6등급의 밝기 차이는 100배다. 그대로 그리면 6등급 별은 점 하나도 안 보인다.
      사람 눈도 로그로 느끼므로, 화면에서는 **등급을 그대로 밝기 눈금에 대응**시킨다.
      대신 '몇 배 밝은가'는 **숫자로** 정확히 보여 준다(2번 장면).
   ========================================================= */
(function (global) {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ---------------------------------------------------------
     1. 거리와 밝기 — 밝기는 거리의 제곱에 반비례
        선생님 학습지의 실험표와 숫자가 맞도록 1.0 m 에서 100 이 되게 잡았다.
          0.5 m → 400 · 1.0 m → 100 · 1.5 m → 44 · 2.0 m → 25
     --------------------------------------------------------- */
  var REF_DIST = 1.0;      // 기준 거리 (m)
  var REF_BRIGHT = 100;    // 그때의 밝기 상댓값

  function brightnessAt(dist) {
    return REF_BRIGHT * (REF_DIST * REF_DIST) / (dist * dist);
  }

  /* 같은 빛이 퍼지는 넓이는 거리의 제곱에 비례한다.
     "왜 제곱인가"를 그림으로 보여 줄 때 쓴다(1번 장면의 격자). */
  function spreadArea(dist) {
    return (dist / REF_DIST) * (dist / REF_DIST);
  }

  /* ---------------------------------------------------------
     2. 등급과 밝기
        1등급 차이 = 100^(1/5) ≈ 2.512 배
        5등급 차이 = 정확히 100 배
     --------------------------------------------------------- */
  var STEP = Math.pow(100, 1 / 5);        // ≈ 2.5118864

  /* 등급 차(어두운 등급 − 밝은 등급) → 밝기가 몇 배인가 */
  function ratioFromMagDiff(dm) {
    return Math.pow(100, dm / 5);
  }

  /* 밝기 비 → 등급 차 */
  function magDiffFromRatio(ratio) {
    return 2.5 * Math.log(ratio) / Math.LN10;
  }

  /* 두 별 중 어느 쪽이 몇 배 밝은가 */
  function compare(m1, m2) {
    var dm = Math.abs(m1 - m2);
    return {
      brighter: (m1 < m2) ? 1 : 2,        // 등급이 **작을수록** 밝다
      magDiff: dm,
      ratio: ratioFromMagDiff(dm)
    };
  }

  /* ---------------------------------------------------------
     3. 겉보기 등급 · 절대 등급 · 거리
        절대 등급 = 별을 모두 10 pc 에 옮겨 놓았다고 가정한 등급
          M = m − 5 log₁₀(d ÷ 10)      (d 의 단위는 pc)
        거꾸로도 쓴다 — 거리를 바꾸면 겉보기 등급이 어떻게 변하는가
          m = M + 5 log₁₀(d ÷ 10)
     --------------------------------------------------------- */
  var STD_DIST = 10;                       // pc — 절대 등급의 기준 거리
  var PC_IN_LY = 3.26;                     // 1 pc ≈ 3.26 광년

  function log10(x) { return Math.log(x) / Math.LN10; }

  function absoluteMag(m, dpc) {
    return m - 5 * log10(dpc / STD_DIST);
  }

  function apparentMag(M, dpc) {
    return M + 5 * log10(dpc / STD_DIST);
  }

  /* 겉보기 등급 − 절대 등급. 이 값 하나로 10 pc 보다 먼지 가까운지 알 수 있다.
       음수면 10 pc 보다 **가깝고**, 0 이면 딱 10 pc, 양수면 **멀다**. */
  function distanceModulus(m, dpc) {
    return m - absoluteMag(m, dpc);
  }

  /* ---------------------------------------------------------
     4. 별의 색과 표면 온도
        선생님 학습지의 색 차례를 그대로 쓴다 —
        청색 · 청백색 · 백색 · 황백색 · 황색 · 주황색 · 적색 (뜨거운 쪽 → 차가운 쪽)
     --------------------------------------------------------- */
  var COLOR_STEPS = [
    { name: "청색",   temp: 25000, css: "#9db4ff" },
    { name: "청백색", temp: 11000, css: "#bfd0ff" },
    { name: "백색",   temp: 8000,  css: "#f2f4ff" },
    { name: "황백색", temp: 6500,  css: "#fff4e2" },
    { name: "황색",   temp: 5500,  css: "#ffe9a8" },
    { name: "주황색", temp: 4000,  css: "#ffc177" },
    { name: "적색",   temp: 3000,  css: "#ff9b6b" }
  ];

  /* 표면 온도 → 색 이름 */
  function colorName(temp) {
    for (var i = 0; i < COLOR_STEPS.length; i++) {
      if (temp >= COLOR_STEPS[i].temp) return COLOR_STEPS[i].name;
    }
    return COLOR_STEPS[COLOR_STEPS.length - 1].name;
  }

  /* 표면 온도 → 화면에 칠할 색 (단계 사이는 섞어 쓴다) */
  function colorOf(temp) {
    var list = COLOR_STEPS;
    if (temp >= list[0].temp) return list[0].css;
    if (temp <= list[list.length - 1].temp) return list[list.length - 1].css;
    for (var i = 0; i < list.length - 1; i++) {
      var hi = list[i], lo = list[i + 1];
      if (temp <= hi.temp && temp >= lo.temp) {
        var t = (temp - lo.temp) / (hi.temp - lo.temp);
        return mix(lo.css, hi.css, t);
      }
    }
    return "#ffffff";
  }

  function mix(a, b, t) {
    function rgb(h) {
      return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
    }
    var A = rgb(a), B = rgb(b), out = "#";
    for (var i = 0; i < 3; i++) {
      var v = Math.round(A[i] + (B[i] - A[i]) * clamp(t, 0, 1));
      out += ("0" + v.toString(16)).slice(-2);
    }
    return out;
  }

  /* ---------------------------------------------------------
     5. 별 자료
        겉보기 등급 m 과 거리 d(pc) 만 담는다. **절대 등급은 계산해서 쓴다**(위 2번).
        거리는 연주시차로 잰 값을 반올림한 것이다.
     --------------------------------------------------------- */
  var STARS = [
    { name: "태양",       m: -26.74, d: 0.0000048, temp: 5800,  note: "우리에게 가장 가까운 별" },
    { name: "시리우스",   m: -1.46,  d: 2.64,      temp: 9940,  note: "밤하늘에서 가장 밝게 보이는 별" },
    { name: "카노푸스",   m: -0.74,  d: 95,        temp: 7350,  note: "남쪽 하늘의 밝은 별" },
    { name: "베가",       m: 0.03,   d: 7.68,      temp: 9600,  note: "직녀성" },
    { name: "리겔",       m: 0.13,   d: 264,       temp: 11000, note: "오리온자리의 푸른 별" },
    { name: "프로키온",   m: 0.34,   d: 3.51,      temp: 6530,  note: "작은개자리" },
    { name: "베텔게우스", m: 0.42,   d: 168,       temp: 3500,  note: "오리온자리의 붉은 별" },
    { name: "알타이르",   m: 0.77,   d: 5.13,      temp: 7550,  note: "견우성" },
    { name: "안타레스",   m: 1.00,   d: 170,       temp: 3400,  note: "전갈자리의 붉은 별" },
    { name: "스피카",     m: 1.04,   d: 77,        temp: 22400, note: "처녀자리의 푸른 별" },
    { name: "북극성",     m: 1.98,   d: 133,       temp: 6015,  note: "북쪽 하늘의 길잡이" }
  ];

  /* 별 하나의 값을 한꺼번에 계산해서 돌려준다 */
  function info(star) {
    var M = absoluteMag(star.m, star.d);
    return {
      name: star.name, note: star.note,
      m: star.m, d: star.d, M: M,
      ly: star.d * PC_IN_LY,
      modulus: star.m - M,
      temp: star.temp,
      color: colorOf(star.temp),
      colorName: colorName(star.temp),
      /* 10 pc 보다 가까운가 먼가 — 3번 장면의 결론 */
      nearer: star.d < STD_DIST
    };
  }

  function byName(name) {
    for (var i = 0; i < STARS.length; i++) if (STARS[i].name === name) return STARS[i];
    return null;
  }

  /* ---------------------------------------------------------
     6. 화면에 그릴 밝기 (0~1)
        등급을 그대로 눈금에 대응시킨다. 실제 밝기 비(100배)를 그대로 쓰면
        어두운 별이 아예 안 보이기 때문이다(위 3번).
        -2등급 = 가장 밝게, +7등급 = 겨우 보이게.
     --------------------------------------------------------- */
  function glowOf(mag) {
    return clamp((7 - mag) / 9, 0.04, 1);
  }

  /* 맨눈으로 볼 수 있는 한계 등급 */
  var EYE_LIMIT = 6;

  global.Stars = {
    REF_DIST: REF_DIST, REF_BRIGHT: REF_BRIGHT, STD_DIST: STD_DIST,
    PC_IN_LY: PC_IN_LY, STEP: STEP, EYE_LIMIT: EYE_LIMIT,
    COLOR_STEPS: COLOR_STEPS, STARS: STARS,
    clamp: clamp, log10: log10,
    brightnessAt: brightnessAt, spreadArea: spreadArea,
    ratioFromMagDiff: ratioFromMagDiff, magDiffFromRatio: magDiffFromRatio, compare: compare,
    absoluteMag: absoluteMag, apparentMag: apparentMag, distanceModulus: distanceModulus,
    colorOf: colorOf, colorName: colorName,
    info: info, byName: byName, glowOf: glowOf
  };
})(window);
