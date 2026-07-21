// Impostral's progressive WebGL arena.
// Three.js is pinned and loaded lazily so the existing DOM arena remains usable
// when WebGL or the CDN is unavailable.
let THREE;
try {
  THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js");
} catch {
  THREE = await import("https://unpkg.com/three@0.180.0/build/three.module.js");
}

const ARENA_COPY = {
  "seat.human": "Human",
  "seat.ai": "AI",
  "seat.you": "You",
  "seat.masked": "Identity masked",
  "seat.vote_one": "{count} vote",
  "seat.vote_many": "{count} votes",
};
const translate = (key, values = {}) => {
  if (window.ImpostralI18n) return window.ImpostralI18n.t(key, values);
  return (ARENA_COPY[key] || key).replace(/\{(\w+)\}/g, (_, name) =>
    values[name] === undefined ? `{${name}}` : String(values[name])
  );
};
const displaySeat = (seatId) =>
  window.ImpostralI18n?.seat(seatId) || seatId;

const COLORS = {
  ink: 0x080706,
  floor: 0x0d0b09,
  panel: 0x17130f,
  panelRaised: 0x24201a,
  orange: 0xff8204,
  yellow: 0xffaf01,
  red: 0xe51300,
  cream: 0xf5f4ef,
  muted: 0x6f6f84,
};

const PHASE_COLORS = {
  lobby: COLORS.orange,
  question: COLORS.yellow,
  vote: COLORS.red,
  resolution: COLORS.orange,
  game_over: COLORS.yellow,
};

function tracked(set, value) {
  set.add(value);
  return value;
}

export function createArena({ canvas, root, labels }) {
  if (!canvas || !root || !labels) return null;

  const compact = matchMedia("(max-width: 720px)").matches;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const seatObjects = new Map();
  const effects = [];
  const textureCache = new Map();
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const worldPoint = new THREE.Vector3();
  const cameraPoint = new THREE.Vector3();
  const baseSceneColor = new THREE.Color(COLORS.ink);
  const baseKeyColor = new THREE.Color(0xffd2a1);
  const baseSkyColor = new THREE.Color(0xffd9a3);
  const resultBackground = new THREE.Color(COLORS.ink);
  const resultAccent = new THREE.Color(COLORS.yellow);
  const resultKeyColor = new THREE.Color(0xffd2a1);
  const resultSkyColor = new THREE.Color(0xffd9a3);
  const resultState = {
    active: false,
    winner: "none",
    winners: new Set(),
    roles: {},
    you: "",
    outcome: "spectate",
    startedAt: 0,
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !compact,
      alpha: false,
      powerPreference: "high-performance",
    });
  } catch (error) {
    root.classList.add("webgl-fallback");
    throw error;
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(COLORS.ink, 1);
  let renderWidth = 0;
  let renderHeight = 0;
  let renderRatio = 0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.ink);
  scene.fog = new THREE.FogExp2(COLORS.ink, 0.052);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 8.4, 13.0);
  camera.lookAt(0, 0.98, 0);

  const environment = new THREE.Group();
  const tableGroup = new THREE.Group();
  const seatGroup = new THREE.Group();
  const effectGroup = new THREE.Group();
  scene.add(environment, tableGroup, seatGroup, effectGroup);

  function geometry(value) {
    return tracked(geometries, value);
  }

  function material(value) {
    return tracked(materials, value);
  }

  function makeMesh(geom, mat) {
    return new THREE.Mesh(geom, mat);
  }

  function standard(color, options = {}) {
    return material(new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.78,
      metalness: options.metalness ?? 0.12,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
      side: options.side ?? THREE.FrontSide,
    }));
  }

  // Lighting is deliberately simple: no real-time shadows and only three lights.
  const hemisphereLight = new THREE.HemisphereLight(0xffd9a3, 0x09070a, 1.55);
  scene.add(hemisphereLight);
  const keyLight = new THREE.DirectionalLight(0xffd2a1, 2.5);
  keyLight.position.set(5, 10, 7);
  scene.add(keyLight);
  const coreLight = new THREE.PointLight(COLORS.orange, 32, 15, 1.6);
  coreLight.position.set(0, 2.4, 0);
  scene.add(coreLight);

  // Floor, grid, outer architecture and a low-poly council table.
  const floor = makeMesh(
    geometry(new THREE.PlaneGeometry(42, 42)),
    standard(COLORS.floor, { roughness: 0.94 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.08;
  environment.add(floor);

  const grid = new THREE.GridHelper(40, 40, COLORS.orange, 0x241912);
  tracked(geometries, grid.geometry);
  grid.position.y = -0.04;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const gridMaterial of gridMaterials) {
    tracked(materials, gridMaterial);
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.19;
  }
  environment.add(grid);

  const polar = new THREE.PolarGridHelper(14, 12, 8, 96, COLORS.orange, 0x342016);
  tracked(geometries, polar.geometry);
  polar.position.y = -0.02;
  const polarMaterials = Array.isArray(polar.material) ? polar.material : [polar.material];
  for (const polarMaterial of polarMaterials) {
    tracked(materials, polarMaterial);
    polarMaterial.transparent = true;
    polarMaterial.opacity = 0.2;
  }
  environment.add(polar);

  const towerGeometry = geometry(new THREE.BoxGeometry(0.42, 1, 0.42));
  const towerMaterials = [
    standard(COLORS.orange, { emissive: COLORS.orange, emissiveIntensity: 0.6 }),
    standard(COLORS.yellow, { emissive: COLORS.yellow, emissiveIntensity: 0.42 }),
    standard(COLORS.red, { emissive: COLORS.red, emissiveIntensity: 0.5 }),
  ];
  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    const height = 0.7 + ((index * 7) % 9) * 0.22;
    const tower = makeMesh(towerGeometry, towerMaterials[index % towerMaterials.length]);
    tower.position.set(Math.cos(angle) * 13.2, height / 2, Math.sin(angle) * 13.2);
    tower.scale.y = height;
    tower.rotation.y = -angle;
    environment.add(tower);
  }

  const tableBase = makeMesh(
    geometry(new THREE.CylinderGeometry(4.75, 5.05, 0.55, 12)),
    standard(0x16110d, { metalness: 0.28, roughness: 0.65 }),
  );
  tableBase.position.y = 0.22;
  tableGroup.add(tableBase);

  const tableTop = makeMesh(
    geometry(new THREE.CylinderGeometry(4.25, 4.48, 0.2, 12)),
    standard(COLORS.panelRaised, { metalness: 0.32, roughness: 0.52 }),
  );
  tableTop.position.y = 0.58;
  tableGroup.add(tableTop);

  const tableRing = makeMesh(
    geometry(new THREE.TorusGeometry(3.35, 0.08, 4, 72)),
    standard(COLORS.orange, { emissive: COLORS.orange, emissiveIntensity: 1.9 }),
  );
  tableRing.rotation.x = Math.PI / 2;
  tableRing.position.y = 0.72;
  tableGroup.add(tableRing);

  // Centrepiece: the trophy every survivor is playing for. It slowly turns on
  // the table and its cup glows with the current phase colour (and the winner
  // accent at game over) through the shared `coreMaterial`.
  const core = new THREE.Group();
  const coreBlocks = [];
  const trophyGold = standard(0xffc24a, {
    metalness: 0.9,
    roughness: 0.26,
    emissive: 0xff8a1e,
    emissiveIntensity: 0.4,
  });
  // `DoubleSide` : la coupe est un cylindre ouvert, sans quoi la paroi intérieure
  // (faces arrière) est cullée et on voit à travers depuis les caméras hautes.
  const coreMaterial = standard(COLORS.orange, {
    emissive: COLORS.orange,
    emissiveIntensity: 2.1,
    metalness: 0.35,
    roughness: 0.32,
    side: THREE.DoubleSide,
  });

  const trophyBase = makeMesh(
    geometry(new THREE.CylinderGeometry(0.62, 0.82, 0.22, 28)),
    trophyGold,
  );
  trophyBase.position.y = 0.92;
  const trophyBaseTop = makeMesh(
    geometry(new THREE.CylinderGeometry(0.4, 0.5, 0.16, 28)),
    trophyGold,
  );
  trophyBaseTop.position.y = 1.1;
  const trophyStem = makeMesh(
    geometry(new THREE.CylinderGeometry(0.12, 0.17, 0.46, 24)),
    trophyGold,
  );
  trophyStem.position.y = 1.4;
  const trophyKnot = makeMesh(
    geometry(new THREE.SphereGeometry(0.2, 24, 18)),
    trophyGold,
  );
  trophyKnot.position.y = 1.64;
  // The cup (open cylinder) carries the phase-reactive glow.
  const trophyCup = makeMesh(
    geometry(new THREE.CylinderGeometry(0.64, 0.26, 0.66, 28, 1, true)),
    coreMaterial,
  );
  trophyCup.position.y = 2.02;
  // Fond de la coupe : le cylindre est ouvert aux deux bouts, ce disque ferme le
  // bas (rayon local ~0,266 à cette hauteur, débordement volontaire dans la paroi).
  const trophyCupFloor = makeMesh(
    geometry(new THREE.CircleGeometry(0.28, 28)),
    coreMaterial,
  );
  trophyCupFloor.rotation.x = -Math.PI / 2;
  trophyCupFloor.position.y = 1.7;
  const trophyRim = makeMesh(
    geometry(new THREE.TorusGeometry(0.62, 0.06, 10, 44)),
    trophyGold,
  );
  trophyRim.rotation.x = Math.PI / 2;
  trophyRim.position.y = 2.35;
  const handleGeometry = geometry(new THREE.TorusGeometry(0.22, 0.05, 8, 26));
  const handleLeft = makeMesh(handleGeometry, trophyGold);
  handleLeft.position.set(-0.62, 2.06, 0);
  handleLeft.rotation.y = Math.PI / 2;
  const handleRight = makeMesh(handleGeometry, trophyGold);
  handleRight.position.set(0.62, 2.06, 0);
  handleRight.rotation.y = Math.PI / 2;
  core.add(
    trophyBase,
    trophyBaseTop,
    trophyStem,
    trophyKnot,
    trophyCup,
    trophyCupFloor,
    trophyRim,
    handleLeft,
    handleRight,
  );

  const coreHalo = makeMesh(
    geometry(new THREE.TorusGeometry(1.2, 0.05, 4, 64)),
    standard(COLORS.yellow, { emissive: COLORS.yellow, emissiveIntensity: 2.2 }),
  );
  coreHalo.rotation.x = Math.PI / 2;
  coreHalo.position.y = 0.9;
  core.add(coreHalo);
  tableGroup.add(core);

  const dustGeometry = geometry(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(180 * 3);
  for (let index = 0; index < 180; index += 1) {
    const radius = 6 + ((index * 17) % 100) / 10;
    const angle = index * 2.39996;
    dustPositions[index * 3] = Math.cos(angle) * radius;
    dustPositions[index * 3 + 1] = 0.2 + ((index * 13) % 50) / 10;
    dustPositions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dustMaterial = material(new THREE.PointsMaterial({
    color: COLORS.orange,
    size: 0.045,
    transparent: true,
    opacity: 0.38,
    sizeAttenuation: true,
  }));
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  environment.add(dust);

  // The result burst is a single draw call and is reused between matches.
  // Winner beacons also share one geometry/material pair across every seat.
  const resultParticleCount = compact ? 42 : 72;
  const resultParticleGeometry = geometry(new THREE.BufferGeometry());
  const resultParticlePositions = new Float32Array(resultParticleCount * 3);
  const resultParticleOrigins = new Float32Array(resultParticleCount * 3);
  const resultParticleVelocities = new Float32Array(resultParticleCount * 3);
  resultParticleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(resultParticlePositions, 3),
  );
  const resultParticleMaterial = material(new THREE.PointsMaterial({
    color: COLORS.yellow,
    size: compact ? 0.095 : 0.11,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  }));
  const resultParticles = new THREE.Points(
    resultParticleGeometry,
    resultParticleMaterial,
  );
  resultParticles.visible = false;
  resultParticles.frustumCulled = false;
  effectGroup.add(resultParticles);

  const resultHaloGeometry = geometry(new THREE.TorusGeometry(1.08, 0.045, 4, 48));
  const resultBeamGeometry = geometry(
    new THREE.CylinderGeometry(0.28, 0.92, 3.8, 8, 1, true),
  );
  const resultHaloMaterial = material(new THREE.MeshBasicMaterial({
    color: COLORS.yellow,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  const resultBeamMaterial = material(new THREE.MeshBasicMaterial({
    color: COLORS.yellow,
    transparent: true,
    opacity: 0.085,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  }));

  const shared = {
    pod: geometry(new THREE.CylinderGeometry(0.76, 0.94, 0.42, 6)),
    seat: geometry(new THREE.BoxGeometry(1.3, 0.18, 1.02)),
    // Dossier volontairement bas : le sprite du personnage commence à y≈0.55 et
    // un dossier plus haut masquerait la tête des sièges vus depuis la caméra.
    back: geometry(new THREE.BoxGeometry(1.38, 0.66, 0.16)),
    ring: geometry(new THREE.TorusGeometry(0.84, 0.055, 4, 36)),
    pip: geometry(new THREE.BoxGeometry(0.12, 0.12, 0.12)),
  };
  const pipMaterial = standard(COLORS.yellow, {
    emissive: COLORS.yellow,
    emissiveIntensity: 1.4,
  });

  function avatarTexture(index) {
    const key = index % 10;
    if (textureCache.has(key)) return textureCache.get(key);
    const texture = tracked(textures, new THREE.TextureLoader().load(
      `/assets/characters/character_${String(key + 1).padStart(2, "0")}.png`,
      requestRender,
      undefined,
      requestRender,
    ));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    textureCache.set(key, texture);
    return texture;
  }

  function createLabel(id) {
    const label = document.createElement("div");
    label.className = "arena-tag";
    // Sert au clic de vote délégué sur le conteneur (cf. `labels.addEventListener`).
    label.dataset.seat = id || "";
    const head = document.createElement("div");
    head.className = "arena-tag-head";
    const name = document.createElement("strong");
    const role = document.createElement("span");
    role.className = "arena-tag-role";
    const answer = document.createElement("p");
    answer.className = "arena-tag-answer";
    const votes = document.createElement("span");
    votes.className = "arena-tag-votes";
    head.append(name, role);
    label.append(head, answer, votes);
    labels.appendChild(label);
    return { label, name, role, answer, votes };
  }

  function createSeat(state, index) {
    const group = new THREE.Group();
    const baseMaterial = standard(COLORS.panelRaised, {
      emissive: COLORS.orange,
      emissiveIntensity: 0.15,
      metalness: 0.3,
      roughness: 0.52,
    });
    const frameMaterial = standard(COLORS.panel, {
      metalness: 0.18,
      roughness: 0.72,
    });
    const ringMaterial = standard(COLORS.orange, {
      emissive: COLORS.orange,
      emissiveIntensity: 0.9,
    });

    const base = makeMesh(shared.pod, baseMaterial);
    base.position.y = 0.2;
    const seat = makeMesh(shared.seat, frameMaterial);
    seat.position.set(0, 0.48, 0.08);
    const back = makeMesh(shared.back, frameMaterial);
    // `+z` local = rayon sortant (cf. positionSeats) : le dossier va donc DERRIÈRE
    // le personnage, qui fait face à la table. À `-z` il se dressait entre la
    // caméra et la tête des sièges du fond — le « carré marron » qui les cachait.
    back.position.set(0, 0.88, 0.55);
    const ring = makeMesh(shared.ring, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.43;

    const spriteMaterial = material(new THREE.SpriteMaterial({
      map: avatarTexture(index),
      transparent: true,
      alphaTest: 0.02,
      depthWrite: false,
    }));
    const sprite = new THREE.Sprite(spriteMaterial);
    // Avancé vers le centre (`-z` local) pour dégager le bas de la tête du
    // dossier sur les sièges vus de dos, les plus proches de la caméra.
    sprite.position.set(0, 1.4, -0.2);
    sprite.scale.set(1.7, 1.7, 1);

    const pips = new THREE.Group();
    pips.position.set(0, 2.08, 0);
    const anchor = new THREE.Object3D();
    anchor.position.set(0, 2.35, 0);
    group.add(base, seat, back, ring, sprite, pips, anchor);
    seatGroup.add(group);

    const dom = createLabel(state.id);
    return {
      id: state.id,
      state,
      group,
      base,
      baseMaterial,
      ringMaterial,
      sprite,
      spriteMaterial,
      pips,
      anchor,
      dom,
      speakingUntil: 0,
      eliminatedAt: 0,
      eliminationEffectPlayed: false,
      resultAura: null,
      targetPosition: new THREE.Vector3(),
      targetScale: new THREE.Vector3(1, 1, 1),
      targetRotation: 0,
      lastVotes: -1,
    };
  }

  function disposeSeat(record) {
    if (record.resultAura) {
      record.group.remove(record.resultAura);
      record.resultAura = null;
    }
    seatGroup.remove(record.group);
    record.dom.label.remove();
  }

  function positionSeats() {
    const records = [...seatObjects.values()];
    const total = Math.max(records.length, 1);
    // Wider ring so pods clear the centre trophy and their screen labels do not
    // pile up. Larger tables spread a little further still.
    const radius = total > 7 ? 6.7 : total > 4 ? 6.1 : 5.4;
    // Bias the ring so no pod sits dead in front of the camera hiding the
    // trophy; the near seats fan out to the sides instead.
    const startAngle = -Math.PI / 2 + Math.PI / total;
    records.forEach((record, index) => {
      const angle = startAngle + (index / total) * Math.PI * 2;
      record.targetPosition.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      record.targetRotation = -angle + Math.PI / 2;
      if (!record.group.userData.positioned) {
        record.group.position.copy(record.targetPosition);
        record.group.rotation.y = record.targetRotation;
        record.group.userData.positioned = true;
      }
    });
  }

  function updateVotePips(record, count) {
    if (record.lastVotes === count) return;
    record.lastVotes = count;
    record.pips.clear();
    const visible = Math.min(count, 5);
    for (let index = 0; index < visible; index += 1) {
      const pip = makeMesh(shared.pip, pipMaterial);
      pip.position.x = (index - (visible - 1) / 2) * 0.18;
      record.pips.add(pip);
    }
  }

  function applyResultLabel(record) {
    const isWinner = resultState.active && resultState.winners.has(record.id);
    const isLoser = resultState.active && !isWinner;
    record.dom.label.classList.toggle("is-winner", isWinner);
    record.dom.label.classList.toggle("is-loser", isLoser);
    record.dom.label.dataset.result = isWinner ? "winner" : isLoser ? "loser" : "";
    record.dom.label.style.borderColor = isWinner ? "#ffaf01" : isLoser ? "#6f4b43" : "";
    record.dom.label.style.background = isWinner
      ? "rgba(30, 20, 5, .94)"
      : isLoser
        ? "rgba(12, 9, 8, .82)"
        : "";
    record.dom.label.style.boxShadow = isWinner
      ? "0 0 0 1px rgba(255,175,1,.2), 0 0 26px rgba(255,130,4,.34)"
      : "";
    record.dom.label.style.opacity = isLoser ? "0.52" : "";
    record.dom.label.style.filter = isLoser ? "grayscale(.72)" : "";
  }

  function attachWinnerAura(record) {
    if (record.resultAura) return;
    const aura = new THREE.Group();
    const lowerHalo = makeMesh(resultHaloGeometry, resultHaloMaterial);
    lowerHalo.rotation.x = Math.PI / 2;
    lowerHalo.position.y = 0.47;
    const upperHalo = makeMesh(resultHaloGeometry, resultHaloMaterial);
    upperHalo.rotation.x = Math.PI / 2;
    upperHalo.position.y = 2.38;
    upperHalo.scale.setScalar(0.66);
    const beam = makeMesh(resultBeamGeometry, resultBeamMaterial);
    beam.position.y = 2.1;
    aura.add(lowerHalo, upperHalo, beam);
    aura.userData.lowerHalo = lowerHalo;
    aura.userData.upperHalo = upperHalo;
    aura.userData.beam = beam;
    record.group.add(aura);
    record.resultAura = aura;
  }

  function configureResultTheme(outcome) {
    if (outcome === "win") {
      resultBackground.setHex(0x160f03);
      resultAccent.setHex(COLORS.yellow);
      resultKeyColor.setHex(0xffd07b);
      resultSkyColor.setHex(0xffc96b);
    } else if (outcome === "lose") {
      resultBackground.setHex(0x160403);
      resultAccent.setHex(COLORS.red);
      resultKeyColor.setHex(0xff8a64);
      resultSkyColor.setHex(0xb64331);
    } else {
      resultBackground.setHex(0x120b05);
      resultAccent.setHex(COLORS.orange);
      resultKeyColor.setHex(0xffbd72);
      resultSkyColor.setHex(0xd8863d);
    }
    resultParticleMaterial.color.copy(resultAccent);
  }

  function seedResultBurst(records) {
    resultParticles.visible = false;
    resultParticleMaterial.opacity = 0;
    if (reducedMotion.matches || !records.length) return;
    for (let index = 0; index < resultParticleCount; index += 1) {
      const source = records[index % records.length];
      const offset = index * 3;
      const angle = index * 2.399963229728653;
      const radial = 0.18 + ((index * 17) % 13) * 0.025;
      const x = source.targetPosition.x + Math.cos(angle) * radial;
      const y = 1.05 + (index % 6) * 0.08;
      const z = source.targetPosition.z + Math.sin(angle) * radial;
      resultParticleOrigins[offset] = x;
      resultParticleOrigins[offset + 1] = y;
      resultParticleOrigins[offset + 2] = z;
      resultParticlePositions[offset] = x;
      resultParticlePositions[offset + 1] = y;
      resultParticlePositions[offset + 2] = z;
      resultParticleVelocities[offset] = Math.cos(angle) * (0.85 + (index % 5) * 0.13);
      resultParticleVelocities[offset + 1] = 1.6 + (index % 9) * 0.12;
      resultParticleVelocities[offset + 2] = Math.sin(angle) * (0.85 + (index % 7) * 0.1);
    }
    resultParticleGeometry.attributes.position.needsUpdate = true;
    resultParticleMaterial.opacity = 0.88;
    resultParticles.visible = true;
  }

  function updateResultBurst(now) {
    if (!resultParticles.visible) return;
    const elapsed = Math.max(0, (now - resultState.startedAt) / 1000);
    if (elapsed >= 3.4 || reducedMotion.matches) {
      resultParticles.visible = false;
      return;
    }
    for (let index = 0; index < resultParticleCount; index += 1) {
      const offset = index * 3;
      resultParticlePositions[offset] =
        resultParticleOrigins[offset] + resultParticleVelocities[offset] * elapsed;
      resultParticlePositions[offset + 1] =
        resultParticleOrigins[offset + 1]
        + resultParticleVelocities[offset + 1] * elapsed
        - 0.72 * elapsed * elapsed;
      resultParticlePositions[offset + 2] =
        resultParticleOrigins[offset + 2] + resultParticleVelocities[offset + 2] * elapsed;
    }
    resultParticleGeometry.attributes.position.needsUpdate = true;
    resultParticleMaterial.opacity = 0.88 * Math.max(0, 1 - elapsed / 3.4);
  }

  function applyResultLighting(delta = 1) {
    const blend = reducedMotion.matches ? 1 : Math.min(0.16, delta * 4.2);
    const backgroundTarget = resultState.active ? resultBackground : baseSceneColor;
    const keyTarget = resultState.active ? resultKeyColor : baseKeyColor;
    const skyTarget = resultState.active ? resultSkyColor : baseSkyColor;
    scene.background.lerp(backgroundTarget, blend);
    scene.fog.color.lerp(backgroundTarget, blend);
    keyLight.color.lerp(keyTarget, blend);
    hemisphereLight.color.lerp(skyTarget, blend);
    keyLight.intensity += ((resultState.active ? 3.35 : 2.5) - keyLight.intensity) * blend;
    hemisphereLight.intensity +=
      ((resultState.active ? 1.05 : 1.55) - hemisphereLight.intensity) * blend;
    coreLight.intensity +=
      ((resultState.active ? 46 : 32) - coreLight.intensity) * blend;
    renderer.toneMappingExposure +=
      ((resultState.active ? 1.2 : 1.08) - renderer.toneMappingExposure) * blend;
  }

  function clearGameOverPresentation() {
    resultState.active = false;
    resultState.winner = "none";
    resultState.winners.clear();
    resultState.roles = {};
    resultState.you = "";
    resultState.outcome = "spectate";
    resultParticles.visible = false;
    resultParticleMaterial.opacity = 0;
    root.classList.remove("arena-game-over");
    delete root.dataset.arenaOutcome;
    delete root.dataset.arenaWinner;
    for (const record of seatObjects.values()) {
      if (record.resultAura) {
        record.group.remove(record.resultAura);
        record.resultAura = null;
      }
      applyResultLabel(record);
    }
    scene.background.copy(baseSceneColor);
    scene.fog.color.copy(baseSceneColor);
    keyLight.color.setHex(0xffd2a1);
    keyLight.intensity = 2.5;
    hemisphereLight.color.setHex(0xffd9a3);
    hemisphereLight.intensity = 1.55;
    coreLight.intensity = 32;
    renderer.toneMappingExposure = 1.08;
    dustMaterial.color.setHex(COLORS.orange);
    tableRing.material.color.setHex(COLORS.orange);
    tableRing.material.emissive.setHex(COLORS.orange);
    coreMaterial.color.setHex(COLORS.orange);
    coreMaterial.emissive.setHex(COLORS.orange);
    coreHalo.material.color.setHex(COLORS.yellow);
    coreHalo.material.emissive.setHex(COLORS.yellow);
    coreLight.color.setHex(COLORS.orange);
  }

  function updateLabel(record) {
    const state = record.state;
    record.dom.name.textContent = displaySeat(state.id || "");
    record.dom.role.textContent = state.role
      ? (
        state.role === "human"
          ? translate("seat.human")
          : (state.model || translate("seat.ai"))
      )
      : (state.you ? translate("seat.you") : translate("seat.masked"));
    record.dom.answer.textContent = state.answer || "";
    record.dom.votes.textContent = state.votes
      ? translate(
        state.votes === 1 ? "seat.vote_one" : "seat.vote_many",
        { count: state.votes },
      )
      : "";
    record.dom.label.classList.toggle("is-you", Boolean(state.you));
    record.dom.label.classList.toggle("is-dead", state.alive === false);
    record.dom.label.classList.toggle("has-answer", Boolean(state.answer));
    record.dom.label.classList.toggle("has-votes", Boolean(state.votes));
    updateVotePips(record, state.votes || 0);
    applyResultLabel(record);
  }

  // Cheap per-frame path for the progressive answer reveal: only the speaking
  // seat's text changes, so a full sync() (every label + positionSeats) would
  // be wasted work sixty times a second.
  function setSeatAnswer(id, text = "") {
    const record = seatObjects.get(id);
    if (!record) return;
    record.state = { ...(record.state || {}), answer: text };
    record.dom.answer.textContent = text;
    record.dom.label.classList.toggle("has-answer", Boolean(text));
    requestRender();
  }

  function sync(snapshot = {}) {
    const incoming = Array.isArray(snapshot.seats) ? snapshot.seats : [];
    const incomingIds = new Set(incoming.map((seat) => seat.id));
    for (const [id, record] of seatObjects) {
      if (!incomingIds.has(id)) {
        disposeSeat(record);
        seatObjects.delete(id);
      }
    }

    incoming.forEach((seat, index) => {
      let record = seatObjects.get(seat.id);
      if (!record) {
        record = createSeat(seat, index);
        seatObjects.set(seat.id, record);
      }
      const previous = record.state || {};
      record.state = {
        ...previous,
        ...seat,
        role: seat.role || previous.role || null,
        model: seat.model || previous.model || null,
      };
      updateLabel(record);
    });
    positionSeats();
    if (snapshot.phase) setPhase(snapshot.phase, snapshot.prompt);
    requestRender();
  }

  let phase = "lobby";
  let prompt = "";
  let active = false;
  let visible = !document.hidden;
  let destroyed = false;
  let raf = 0;
  let lastTime = performance.now();
  let firstFrameRendered = false;
  let selectedSeat = "";
  let answerTurnSeat = "";
  let voteTargets = new Set();
  let voteHandler = null;

  // Voter en cliquant directement l'étiquette du joueur dans l'arène : le clic
  // remonte au panneau de vote, qui reste la source de vérité (sélection,
  // `aria-checked`, envoi). Délégué sur le conteneur pour survivre au
  // recyclage des étiquettes par `sync()`.
  function onLabelClick(event) {
    if (!voteHandler) return;
    const label = event.target.closest?.(".arena-tag");
    const id = label?.dataset.seat;
    if (!id || !voteTargets.has(id)) return;
    voteHandler(id);
  }
  labels.addEventListener("click", onLabelClick);

  // Le panneau de vote branche/débranche ce rappel à l'ouverture/fermeture.
  function setVoteHandler(handler = null) {
    voteHandler = typeof handler === "function" ? handler : null;
  }

  function setPhase(nextPhase = "lobby", nextPrompt = "") {
    if (nextPhase !== "game_over" && resultState.active) {
      clearGameOverPresentation();
    }
    phase = nextPhase;
    prompt = nextPrompt || prompt;
    if (phase !== "question") setAnswerTurn("");
    const color = PHASE_COLORS[phase] || COLORS.orange;
    coreMaterial.color.setHex(color);
    coreMaterial.emissive.setHex(color);
    coreHalo.material.color.setHex(color);
    coreHalo.material.emissive.setHex(color);
    coreLight.color.setHex(color);
    root.dataset.arenaPhase = phase;
    requestRender();
  }

  function setSpeaking(id, duration = 2500) {
    const record = seatObjects.get(id);
    if (!record) return;
    record.speakingUntil = performance.now() + duration;
    record.dom.label.classList.add("is-speaking");
    requestRender();
  }

  function setAnswerTurn(id = "") {
    answerTurnSeat = id;
    root.classList.toggle("arena-answer-turn", Boolean(id));
    for (const record of seatObjects.values()) {
      record.dom.label.classList.toggle("is-answering", record.id === id);
    }
    requestRender();
  }

  function setVoteTargets(targets = []) {
    voteTargets = new Set(targets);
    root.classList.toggle("arena-voting", voteTargets.size > 0);
    for (const record of seatObjects.values()) {
      record.dom.label.classList.toggle("is-vote-target", voteTargets.has(record.id));
    }
    requestRender();
  }

  function setSelected(id = "") {
    selectedSeat = id;
    for (const record of seatObjects.values()) {
      record.dom.label.classList.toggle("is-selected", record.id === id);
    }
    requestRender();
  }

  function showVoteResult({ tally = {}, eliminated = null } = {}) {
    for (const record of seatObjects.values()) {
      record.state.votes = tally[record.id] || 0;
      updateLabel(record);
    }
    selectedSeat = eliminated || "";
    setVoteTargets([]);
    requestRender();
  }

  function spawnElimination(record) {
    const group = new THREE.Group();
    const particleGeometry = geometry(new THREE.BoxGeometry(0.14, 0.14, 0.14));
    const particleMaterial = standard(COLORS.red, {
      emissive: COLORS.red,
      emissiveIntensity: 2.4,
    });
    for (let index = 0; index < 22; index += 1) {
      const cube = makeMesh(particleGeometry, particleMaterial);
      cube.position.copy(record.group.position);
      cube.position.y = 0.8 + (index % 4) * 0.22;
      cube.userData.velocity = new THREE.Vector3(
        (((index * 37) % 17) - 8) * 0.055,
        0.05 + (index % 7) * 0.018,
        (((index * 23) % 19) - 9) * 0.05,
      );
      group.add(cube);
    }
    effectGroup.add(group);
    effects.push({ group, born: performance.now(), duration: 1800 });
  }

  function eliminate(id, role = null, model = null) {
    const record = seatObjects.get(id);
    if (!record) return;
    const firstReveal = !record.eliminationEffectPlayed;
    record.state.alive = false;
    record.state.role = role || record.state.role;
    record.state.model = model || record.state.model;
    record.eliminatedAt ||= performance.now();
    record.eliminationEffectPlayed = true;
    updateLabel(record);
    if (firstReveal) spawnElimination(record);
    requestRender();
  }

  /**
   * Present the final state of a match.
   *
   * Expected payload:
   * {
   *   winner: "humans" | "agents" | "none",
   *   winners: string[],
   *   roles: Record<string, "human" | "llm">,
   *   models?: Record<string, string>,
   *   you?: string,
   *   seats?: SeatSnapshot[],
   *   message?: string,
   *   prompt?: string
   * }
   */
  function showGameOver(payload = {}) {
    if (resultState.active) clearGameOverPresentation();
    if (Array.isArray(payload.seats)) {
      sync({
        seats: payload.seats,
        phase: "game_over",
        prompt: payload.prompt || payload.message || "",
      });
    } else {
      setPhase("game_over", payload.prompt || payload.message || "");
    }

    const roles = payload.roles && typeof payload.roles === "object"
      ? payload.roles
      : {};
    const models = payload.models && typeof payload.models === "object"
      ? payload.models
      : {};
    const winners = Array.isArray(payload.winners)
      ? payload.winners.filter((id) => typeof id === "string")
      : [];
    const inferredYou = [...seatObjects.values()].find((record) => record.state.you)?.id || "";
    const you = typeof payload.you === "string" ? payload.you : inferredYou;
    const winner = typeof payload.winner === "string" ? payload.winner : "none";
    const outcome = !you
      ? "spectate"
      : winner === "none" || winners.length === 0
        ? "draw"
        : winners.includes(you)
          ? "win"
          : "lose";

    resultState.active = true;
    resultState.winner = winner;
    resultState.winners = new Set(winners);
    resultState.roles = { ...roles };
    resultState.you = you;
    resultState.outcome = outcome;
    resultState.startedAt = performance.now();
    configureResultTheme(outcome);

    const winnerRecords = [];
    for (const record of seatObjects.values()) {
      if (Object.prototype.hasOwnProperty.call(roles, record.id)) {
        record.state.role = roles[record.id];
      }
      if (Object.prototype.hasOwnProperty.call(models, record.id)) {
        record.state.model = models[record.id];
      }
      if (resultState.winners.has(record.id)) {
        attachWinnerAura(record);
        winnerRecords.push(record);
      }
      updateLabel(record);
    }

    root.classList.add("arena-game-over");
    root.dataset.arenaOutcome = outcome;
    root.dataset.arenaWinner = winner;
    coreMaterial.color.copy(resultAccent);
    coreMaterial.emissive.copy(resultAccent);
    coreHalo.material.color.copy(resultAccent);
    coreHalo.material.emissive.copy(resultAccent);
    coreLight.color.copy(resultAccent);
    dustMaterial.color.copy(resultAccent);
    tableRing.material.color.copy(resultAccent);
    tableRing.material.emissive.copy(resultAccent);
    seedResultBurst(winnerRecords);
    if (reducedMotion.matches) applyResultLighting(1);
    requestRender();
  }

  // Backward-compatible alias for callers that already pass the final payload.
  function gameOver(payload = {}) {
    showGameOver(payload);
  }

  function reset() {
    clearGameOverPresentation();
    setAnswerTurn("");
    setVoteTargets([]);
    setSelected("");
    for (const record of seatObjects.values()) disposeSeat(record);
    seatObjects.clear();
    labels.replaceChildren();
    phase = "lobby";
    prompt = "";
    setActive(false);
  }

  const LABEL_MARGIN = 6;

  function updateLabels() {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;
    for (const record of seatObjects.values()) {
      record.anchor.getWorldPosition(worldPoint);
      cameraPoint.copy(worldPoint).applyMatrix4(camera.matrixWorldInverse);
      worldPoint.project(camera);
      const offscreen = cameraPoint.z >= 0
        || worldPoint.z < -1
        || worldPoint.z > 1
        || Math.abs(worldPoint.x) > 1.15
        || Math.abs(worldPoint.y) > 1.15;
      record.dom.label.hidden = offscreen;
      if (offscreen) continue;
      let x = (worldPoint.x * 0.5 + 0.5) * width;
      let y = (-worldPoint.y * 0.5 + 0.5) * height;
      // Keep the whole tag inside the arena, which clips its overflow: a seat
      // near an edge would otherwise have its answer cut off by the container
      // rather than by any style rule. Tags are centred on their anchor, so the
      // clamp works on half-extents.
      const halfW = record.dom.label.offsetWidth / 2;
      const halfH = record.dom.label.offsetHeight / 2;
      x = Math.min(Math.max(x, halfW + LABEL_MARGIN), width - halfW - LABEL_MARGIN);
      y = Math.min(Math.max(y, halfH + LABEL_MARGIN), height - halfH - LABEL_MARGIN);
      record.dom.label.style.transform =
        `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    }
  }

  function updateEffects(now, delta) {
    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];
      const progress = (now - effect.born) / effect.duration;
      for (const cube of effect.group.children) {
        cube.position.addScaledVector(cube.userData.velocity, delta * 60);
        cube.userData.velocity.y -= 0.0018 * delta * 60;
        cube.rotation.x += delta * 2.5;
        cube.rotation.y += delta * 3.1;
        cube.scale.setScalar(Math.max(0.01, 1 - progress));
      }
      if (progress >= 1) {
        effectGroup.remove(effect.group);
        effects.splice(index, 1);
      }
    }
  }

  function update(now) {
    const delta = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    pointer.lerp(pointerTarget, 0.045);

    const slowTime = now * 0.00016;
    const voteZoom = phase === "vote" ? 0.9 : 0;
    const resultZoom = resultState.active ? 0.72 : 0;
    camera.position.x =
      Math.sin(slowTime) * (resultState.active ? 0.5 : 0.78) + pointer.x * 1.25;
    camera.position.y = 8.4 - voteZoom - resultZoom + pointer.y * 0.45;
    camera.position.z = 13.0 - voteZoom - resultZoom;
    camera.lookAt(0, resultState.active ? 1.12 : 0.98, 0);

    core.rotation.y = now * 0.00042;
    core.position.y = Math.sin(now * 0.0016) * 0.08;
    coreHalo.rotation.z = now * 0.00055;
    dust.rotation.y = now * 0.000025;

    for (const [index, block] of coreBlocks.entries()) {
      block.rotation.y = now * (0.00035 + index * 0.00008) * (index % 2 ? -1 : 1);
    }

    for (const record of seatObjects.values()) {
      const speaking = record.speakingUntil > now;
      const answering = record.id === answerTurnSeat;
      const dead = record.state.alive === false;
      const selected = record.id === selectedSeat;
      const voteTarget = voteTargets.has(record.id);
      const resultWinner = resultState.active && resultState.winners.has(record.id);
      const resultLoser = resultState.active && !resultWinner;
      const baseY = resultWinner ? 0.46 : dead ? -0.48 : resultLoser ? -0.18 : 0;
      const lift = resultState.active
        ? resultWinner && !reducedMotion.matches
          ? Math.sin(now * 0.0025) * 0.045
          : 0
        : speaking
        ? 0.26 + Math.sin(now * 0.008) * 0.05
        : answering
          ? 0.13
          : 0;

      const seatBlend = reducedMotion.matches ? 1 : 0.08;
      record.group.position.lerp(record.targetPosition, seatBlend);
      record.group.position.y +=
        (baseY + lift - record.group.position.y) * (reducedMotion.matches ? 1 : 0.1);
      record.group.rotation.y +=
        (record.targetRotation - record.group.rotation.y) * (reducedMotion.matches ? 1 : 0.08);
      if (dead) record.group.rotation.z += (-0.1 - record.group.rotation.z) * 0.05;

      const targetScale = resultWinner
        ? 1.14
        : resultLoser
          ? dead ? 0.68 : 0.86
          : dead
            ? 0.78
            : speaking
              ? 1.08
              : answering
                ? 1.04
                : 1;
      record.targetScale.setScalar(targetScale);
      record.group.scale.lerp(record.targetScale, reducedMotion.matches ? 1 : 0.08);

      const color = resultWinner
        ? COLORS.yellow
        : resultLoser
          ? COLORS.muted
          : dead
        ? COLORS.muted
        : selected
          ? COLORS.red
          : speaking
            ? COLORS.yellow
            : answering
              ? COLORS.yellow
              : COLORS.orange;
      record.ringMaterial.color.setHex(color);
      record.ringMaterial.emissive.setHex(color);
      record.ringMaterial.emissiveIntensity = resultWinner
        ? 3
        : resultLoser
          ? 0.035
          : dead
        ? 0.05
        : speaking
          ? 2.8
          : selected
            ? 2.2
            : answering
              ? 1.75
              : 0.85;
      record.baseMaterial.emissive.setHex(color);
      record.baseMaterial.emissiveIntensity = resultWinner
        ? 1.4
        : resultLoser
          ? 0
          : dead
        ? 0
        : speaking
          ? 1.15
          : answering
            ? 0.72
            : voteTarget
              ? 0.5
              : 0.14;
      record.spriteMaterial.opacity = resultWinner
        ? 1
        : resultLoser
          ? dead ? 0.16 : 0.36
          : dead
            ? 0.24
            : voteTargets.size && !voteTarget
              ? 0.55
              : 1;
      record.spriteMaterial.color.setHex(
        resultWinner ? 0xfff3c4 : resultLoser || dead ? 0x777777 : 0xffffff,
      );
      if (record.resultAura) {
        record.resultAura.visible = resultWinner;
        const lowerHalo = record.resultAura.userData.lowerHalo;
        const upperHalo = record.resultAura.userData.upperHalo;
        lowerHalo.rotation.z = reducedMotion.matches ? 0 : now * 0.0008;
        upperHalo.rotation.z = reducedMotion.matches ? Math.PI / 4 : -now * 0.0011;
      }
      record.dom.label.classList.toggle("is-answering", answering);
      record.dom.label.classList.toggle("is-speaking", speaking);
    }

    applyResultLighting(delta);
    updateResultBurst(now);
    updateEffects(now, delta);
    updateLabels();
  }

  function resize() {
    const width = Math.floor(root.clientWidth);
    const height = Math.floor(root.clientHeight);
    if (width < 4 || height < 4) return false;
    const ratioLimit = compact ? 1 : 1.5;
    const ratio = Math.min(devicePixelRatio || 1, ratioLimit);
    if (width !== renderWidth || height !== renderHeight || ratio !== renderRatio) {
      renderWidth = width;
      renderHeight = height;
      renderRatio = ratio;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    return true;
  }

  function renderFrame(now = performance.now()) {
    if (destroyed || !resize()) return false;
    update(now);
    renderer.render(scene, camera);
    if (!firstFrameRendered) {
      firstFrameRendered = true;
      root.classList.remove("webgl-fallback");
      root.classList.add("webgl-ready");
      root.dataset.webglEngine = `three-r${THREE.REVISION}`;
    }
    return true;
  }

  function loop(now) {
    raf = 0;
    if (!active || !visible || reducedMotion.matches || destroyed) return;
    renderFrame(now);
    raf = requestAnimationFrame(loop);
  }

  function requestRender() {
    if (destroyed) return;
    if (reducedMotion.matches || !active || !visible) {
      queueMicrotask(() => renderFrame());
      return;
    }
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function setActive(next) {
    active = Boolean(next);
    if (!active && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (active) requestRender();
  }

  function onPointerMove(event) {
    if (reducedMotion.matches) return;
    const rect = root.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerTarget.set(
      ((event.clientX - rect.left) / rect.width - 0.5) * 2,
      -((event.clientY - rect.top) / rect.height - 0.5) * 2,
    );
  }

  function onPointerLeave() {
    pointerTarget.set(0, 0);
  }

  function onVisibilityChange() {
    visible = !document.hidden;
    if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (visible && active) {
      requestRender();
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    root.classList.remove("webgl-ready");
    root.classList.add("webgl-fallback");
  }

  function onContextRestored() {
    if (active) requestRender();
  }

  const resizeObserver = new ResizeObserver(requestRender);
  resizeObserver.observe(root);
  root.addEventListener("pointermove", onPointerMove, { passive: true });
  root.addEventListener("pointerleave", onPointerLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotion.addEventListener?.("change", requestRender);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  function destroy() {
    if (destroyed) return;
    clearGameOverPresentation();
    destroyed = true;
    if (raf) cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerleave", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.removeEventListener?.("change", requestRender);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    canvas.removeEventListener("webglcontextrestored", onContextRestored);
    for (const texture of textures) texture.dispose();
    for (const geom of geometries) geom.dispose();
    for (const mat of materials) mat.dispose();
    renderer.dispose();
    labels.removeEventListener("click", onLabelClick);
    voteHandler = null;
    labels.replaceChildren();
    root.classList.remove("webgl-ready");
  }

  return {
    sync,
    setActive,
    setPhase,
    setAnswerTurn,
    setSeatAnswer,
    setSpeaking,
    setVoteTargets,
    setVoteHandler,
    setSelected,
    showVoteResult,
    eliminate,
    showGameOver,
    gameOver,
    reset,
    destroy,
  };
}
