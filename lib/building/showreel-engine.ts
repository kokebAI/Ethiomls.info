import * as THREE from "three";
import type { Building, BuildingFloor } from "@/lib/building/types";
import { countAvailableUnits, sortFloorsTopDown } from "@/lib/building/types";

export type ShowreelEngineOptions = {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  building: Building;
  activeLevel?: number | null;
  onFloorSelect?: (level: number) => void;
  autoRotate?: boolean;
};

const FLOOR_H = 0.55;
const FLOOR_GAP = 0.08;
const TOWER_W = 3.2;
const TOWER_D = 2.4;

/**
 * Cinematic Three.js off-plan tower — orbit showreel with clickable floors.
 */
export class BuildingShowreelEngine {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly onFloorSelect?: (level: number) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private tower = new THREE.Group();
  private floorMeshes = new Map<number, THREE.Mesh>();
  private floors: BuildingFloor[] = [];
  private activeLevel: number | null = null;
  private autoRotate: boolean;
  private raf = 0;
  private disposed = false;

  private azimuth = 0.55;
  private polar = 1.15;
  private radius = 11;
  private target = new THREE.Vector3(0, 0, 0);
  private dragging = false;
  private dragDistance = 0;
  private lastX = 0;
  private lastY = 0;
  private pointerId: number | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: ShowreelEngineOptions) {
    this.container = options.container;
    this.canvas = options.canvas;
    this.onFloorSelect = options.onFloorSelect;
    this.autoRotate = options.autoRotate ?? true;
    this.activeLevel = options.activeLevel ?? null;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b1220, 0.028);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);

    this.scene.add(new THREE.HemisphereLight(0xfff1d6, 0x1e293b, 0.55));
    this.scene.add(new THREE.AmbientLight(0xfff4e0, 0.35));
    const key = new THREE.DirectionalLight(0xffe0a8, 1.25);
    key.position.set(6, 10, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ec5ff, 0.4);
    fill.position.set(-5, 3, -4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfbbf24, 0.35);
    rim.position.set(0, 4, -6);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(8, 48),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.2,
        roughness: 0.85,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.6, 4.1, 64),
      new THREE.MeshBasicMaterial({
        color: 0xd97706,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);

    this.scene.add(this.tower);
    this.setBuilding(options.building);
    this.bindEvents();
    this.resize();
    this.tick();
  }

  setBuilding(building: Building) {
    for (const child of [...this.tower.children]) {
      this.tower.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
    this.floorMeshes.clear();
    this.floors = sortFloorsTopDown(building.floors);

    const levelsAsc = [...this.floors].sort((a, b) => a.level - b.level);
    const totalH =
      levelsAsc.length * (FLOOR_H + FLOOR_GAP) - FLOOR_GAP + 0.4;
    this.target.set(0, totalH / 2, 0);
    this.radius = Math.max(9, 6 + levelsAsc.length * 0.35);

    // Core shaft
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W * 0.35, totalH, TOWER_D * 0.35),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.45,
        roughness: 0.4,
      }),
    );
    core.position.y = totalH / 2;
    this.tower.add(core);

    levelsAsc.forEach((floor, index) => {
      const available = countAvailableUnits(floor);
      const y = index * (FLOOR_H + FLOOR_GAP) + FLOOR_H / 2;
      const color =
        available > 0
          ? floor.level === this.activeLevel
            ? 0xd97706
            : 0xcbd5e1
          : 0x64748b;

      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(TOWER_W, FLOOR_H, TOWER_D),
        new THREE.MeshStandardMaterial({
          color,
          metalness: 0.25,
          roughness: 0.45,
          emissive: floor.level === this.activeLevel ? 0xd97706 : 0x000000,
          emissiveIntensity: floor.level === this.activeLevel ? 0.22 : 0,
        }),
      );
      slab.position.y = y;
      slab.userData.floorLevel = floor.level;
      this.tower.add(slab);
      this.floorMeshes.set(floor.level, slab);

      // Window strip accent
      const glass = new THREE.Mesh(
        new THREE.BoxGeometry(TOWER_W * 0.92, FLOOR_H * 0.45, TOWER_D * 1.02),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          metalness: 0.7,
          roughness: 0.15,
          transparent: true,
          opacity: available > 0 ? 0.35 : 0.12,
        }),
      );
      glass.position.y = y;
      glass.userData.floorLevel = floor.level;
      this.tower.add(glass);
    });

    // Roof cap
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(TOWER_W * 1.08, 0.22, TOWER_D * 1.08),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.5,
        roughness: 0.35,
      }),
    );
    roof.position.y = totalH + 0.05;
    this.tower.add(roof);
  }

  setActiveLevel(level: number | null) {
    this.activeLevel = level;
    for (const [floorLevel, mesh] of this.floorMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const floor = this.floors.find((f) => f.level === floorLevel);
      const available = floor ? countAvailableUnits(floor) : 0;
      const active = floorLevel === level;
      mat.color.setHex(
        active ? 0xd97706 : available > 0 ? 0xcbd5e1 : 0x64748b,
      );
      mat.emissive.setHex(active ? 0xd97706 : 0x000000);
      mat.emissiveIntensity = active ? 0.28 : 0;
      mesh.scale.set(active ? 1.06 : 1, 1, active ? 1.06 : 1);
    }
  }

  private bindEvents() {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerUp);
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", this.resize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
  }

  private onPointerDown = (event: PointerEvent) => {
    this.dragging = true;
    this.dragDistance = 0;
    this.autoRotate = false;
    this.pointerId = event.pointerId;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.dragDistance += Math.abs(dx) + Math.abs(dy);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.azimuth -= dx * 0.005;
    this.polar = Math.min(
      Math.PI * 0.48,
      Math.max(0.35, this.polar + dy * 0.004),
    );
  };

  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    try {
      this.canvas.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  private onWheel = (event: WheelEvent) => {
    event.preventDefault();
    this.autoRotate = false;
    this.radius = Math.min(22, Math.max(6, this.radius + event.deltaY * 0.012));
  };

  private onClick = (event: MouseEvent) => {
    if (this.dragDistance > 8) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.tower.children, false);
    for (const hit of hits) {
      const level = hit.object.userData.floorLevel;
      if (typeof level === "number") {
        this.setActiveLevel(level);
        this.onFloorSelect?.(level);
        break;
      }
    }
  };

  private resize = () => {
    const width = this.container.clientWidth || 320;
    const height = this.container.clientHeight || 420;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  };

  private updateCamera() {
    if (this.autoRotate && !this.dragging) {
      this.azimuth += 0.004;
    }
    const x = this.radius * Math.sin(this.polar) * Math.sin(this.azimuth);
    const y = this.radius * Math.cos(this.polar) + this.target.y * 0.15;
    const z = this.radius * Math.sin(this.polar) * Math.cos(this.azimuth);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.target);
  }

  private tick = () => {
    if (this.disposed) return;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerUp);
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.resize);
    this.renderer.dispose();
  }
}
