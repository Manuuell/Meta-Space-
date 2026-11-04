import * as THREE from 'three';

// META SPACE — El hangar al aire libre: cielo retro, planeta anillado y la plataforma
// con sus anillos de luz. Lo comparten el astillero y la forja de héroes: la forja lo
// usa a menor escala, porque un héroe es mucho más pequeño que una nave.

export function crearHangar(): THREE.Group {
  const g = new THREE.Group();
  // Cielo retro: del verde agua al melocotón, con un planeta anillado enorme.
  const planeta = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    const cuerpo = g.createRadialGradient(420, 400, 40, 512, 512, 320);
    cuerpo.addColorStop(0, '#fff3dc');
    cuerpo.addColorStop(0.7, '#f0c8a8');
    cuerpo.addColorStop(1, '#c58e86');
    g.fillStyle = cuerpo;
    g.beginPath();
    g.arc(512, 512, 300, 0, Math.PI * 2);
    g.fill();
    g.translate(512, 512);
    g.rotate(-0.32);
    for (let k = 0; k < 26; k++) {
      g.strokeStyle = `rgba(255, 245, 225, ${0.1 + (k % 3) * 0.1})`;
      g.lineWidth = 3 + (k % 4) * 3;
      g.beginPath();
      g.ellipse(0, 0, 370 + k * 6, 66 + k * 1.1, 0, 0, Math.PI * 2);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: 'varying vec3 vP; void main() { vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP;
      void main() {
        float h = clamp(vP.y, -0.1, 1.0);
        vec3 c = mix(vec3(1.0, 0.72, 0.52), vec3(0.36, 0.86, 0.72), smoothstep(0.0, 0.22, h));
        c = mix(c, vec3(0.05, 0.36, 0.42), smoothstep(0.2, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  g.add(cielo);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: planeta, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  sprite.position.set(-310, 150, -560);
  sprite.scale.setScalar(620);
  g.add(sprite);

  // Plataforma: suelo oscuro, anillo de luz y marcas de pista.
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(700, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#123238', metalness: 0.4, roughness: 0.62 }));
  suelo.receiveShadow = true;
  g.add(suelo);
  const pista = new THREE.Mesh(new THREE.CylinderGeometry(25, 26.5, 0.8, 72), new THREE.MeshStandardMaterial({ color: '#1f2a33', metalness: 0.7, roughness: 0.4 }));
  pista.position.y = 0.2;
  pista.receiveShadow = true;
  g.add(pista);
  for (const [r, c] of [[25.2, '#ff8a3d'], [20, '#5ee0ff']] as const) {
    const a = new THREE.Mesh(new THREE.RingGeometry(r - 0.22, r, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    a.position.y = 0.62;
    g.add(a);
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.5), new THREE.MeshBasicMaterial({ color: k % 2 ? '#ffd9a0' : '#20303a', toneMapped: false }));
    m.position.set(Math.cos(a) * 22.6, 0.63, Math.sin(a) * 22.6);
    m.rotation.y = -a;
    g.add(m);
  }
  return g;
}
