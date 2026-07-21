// Progressive Three.js bootstrap. The 2D DOM arena remains the fallback, and is
// the *preferred* renderer on mobile: phones skip the WebGL arena entirely so
// there is no Three.js CDN download and no GPU/battery cost.
(function () {
  const canvas = document.getElementById("arena-canvas");
  const root = document.querySelector(".arena-viz");
  const labels = document.getElementById("arena-labels");

  if (!canvas || !root || !labels) {
    window.ImpostralArena3DReady = Promise.resolve(null);
    return;
  }

  // Touch phones and small screens get the optimized 2D arena. This is decided
  // once at load; a desktop window later shrunk below the threshold keeps 3D.
  function prefers2D() {
    try {
      return window.matchMedia("(max-width: 980px)").matches
        || (window.matchMedia("(pointer: coarse)").matches
          && window.matchMedia("(max-width: 1180px)").matches);
    } catch (error) {
      return false;
    }
  }

  if (prefers2D()) {
    root.classList.add("webgl-fallback", "arena-2d");
    window.ImpostralArena3DReady = Promise.resolve(null);
    return;
  }

  window.ImpostralArena3DReady = import("/static/arena3d.js?v=20260721-v25")
    .then(({ createArena }) => createArena({ canvas, root, labels }))
    .catch((error) => {
      console.warn("3D arena unavailable; using the 2D fallback.", error);
      root.classList.add("webgl-fallback");
      return null;
    });
})();
