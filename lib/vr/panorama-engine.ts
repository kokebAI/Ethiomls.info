import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { VrHotspot, VirtualWalkthroughConfig } from "@/lib/vr/types";

export type PanoramaEngineOptions = {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  overlayRoot: HTMLElement;
  imageUrls: string[];
  config?: VirtualWalkthroughConfig | null;
  initialIndex?: number;
  onSceneChange?: (index: number) => void;
  onHotspotFocus?: (label: string | null) => void;
  onError?: (message: string) => void;
};

type PointerState = {
  active: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
};

const SPHERE_RADIUS = 500;
const HOTSPOT_RADIUS = 480;
const DRAG_SPEED = 0.15;
const TRANSITION_MS = 520;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hotspotWorldPosition(yawDeg: number, pitchDeg: number): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - pitchDeg);
  const theta = THREE.MathUtils.degToRad(yawDeg);
  return new THREE.Vector3(
    HOTSPOT_RADIUS * Math.sin(phi) * Math.cos(theta),
    HOTSPOT_RADIUS * Math.cos(phi),
    HOTSPOT_RADIUS * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Imperative Three.js walkthrough engine (sphere + drag + gyro + hotspots).
 * Mounted by the React `VrViewer` canvas component.
 */
export class PanoramaEngine {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlayRoot: HTMLElement;
  private readonly imageUrls: string[];
  private readonly config: VirtualWalkthroughConfig | null;
  private readonly onSceneChange?: (index: number) => void;
  private readonly onHotspotFocus?: (label: string | null) => void;
  private readonly onError?: (message: string) => void;

  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sphere: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private textures = new Map<number, THREE.Texture>();
  private loader = new THREE.TextureLoader();
  private hotspotGroup = new THREE.Group();
  private hotspotObjects: CSS2DObject[] = [];

  private lon: number;
  private lat: number;
  private sceneIndex: number;
  private pointer: PointerState = {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  };
  private gyroEnabled = false;
  private gyroBaseline: { alpha: number; beta: number; gamma: number } | null =
    null;
  private transitioning = false;
  private rafId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: PanoramaEngineOptions) {
    this.container = options.container;
    this.canvas = options.canvas;
    this.overlayRoot = options.overlayRoot;
    this.imageUrls = options.imageUrls;
    this.config = options.config ?? null;
    this.onSceneChange = options.onSceneChange;
    this.onHotspotFocus = options.onHotspotFocus;
    this.onError = options.onError;

    this.sceneIndex = clamp(
      options.initialIndex ?? 0,
      0,
      Math.max(0, this.imageUrls.length - 1),
    );
    this.lon = this.config?.startYaw ?? 0;
    this.lat = this.config?.startPitch ?? 0;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1100);
    this.camera.position.set(0, 0, 0.01);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0b1411, 1);

    this.labelRenderer = new CSS2DRenderer({ element: this.overlayRoot });
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.inset = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";

    this.material = new THREE.MeshBasicMaterial({
      map: null,
      transparent: true,
      opacity: 1,
    });

    const geometry = new THREE.SphereGeometry(SPHERE_RADIUS, 64, 48);
    // Negative X scale makes the equirectangular map face inward from the camera.
    geometry.scale(-1, 1, 1);
    this.sphere = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.sphere);
    this.scene.add(this.hotspotGroup);

    this.bindEvents();
    this.resize();
    void this.loadScene(this.sceneIndex, { animate: false });
    this.tick();
  }

  get activeIndex() {
    return this.sceneIndex;
  }

  async enableGyroscope(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied" | "default">;
    };

    try {
      if (typeof DOE.requestPermission === "function") {
        const permission = await DOE.requestPermission();
        if (permission !== "granted") return false;
      }
    } catch {
      return false;
    }

    this.gyroEnabled = true;
    this.gyroBaseline = null;
    return true;
  }

  disableGyroscope() {
    this.gyroEnabled = false;
    this.gyroBaseline = null;
  }

  isGyroEnabled() {
    return this.gyroEnabled;
  }

  goToScene(index: number) {
    if (
      index < 0 ||
      index >= this.imageUrls.length ||
      index === this.sceneIndex ||
      this.transitioning
    ) {
      return;
    }
    void this.loadScene(index, { animate: true });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.unbindEvents();
    this.resizeObserver?.disconnect();
    this.clearHotspots();

    for (const texture of this.textures.values()) {
      texture.dispose();
    }
    this.textures.clear();

    this.material.map = null;
    this.material.dispose();
    this.sphere.geometry.dispose();
    this.renderer.dispose();
    this.overlayRoot.replaceChildren();
  }

  private bindEvents() {
    this.canvas.style.touchAction = "none";
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
    window.addEventListener("deviceorientation", this.onDeviceOrientation);
    window.addEventListener("resize", this.resize);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
  }

  private unbindEvents() {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
    window.removeEventListener("deviceorientation", this.onDeviceOrientation);
    window.removeEventListener("resize", this.resize);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    this.pointer = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.pointer.active) return;
    if (
      this.pointer.pointerId !== null &&
      event.pointerId !== this.pointer.pointerId
    ) {
      return;
    }

    const dx = event.clientX - this.pointer.lastX;
    const dy = event.clientY - this.pointer.lastY;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;

    // Dragging disables temporary gyro baseline drift feeling.
    this.lon -= dx * DRAG_SPEED;
    this.lat += dy * DRAG_SPEED;
    this.lat = clamp(this.lat, -85, 85);
  };

  private onPointerUp = (event: PointerEvent) => {
    if (
      this.pointer.pointerId !== null &&
      event.pointerId !== this.pointer.pointerId
    ) {
      return;
    }
    this.pointer.active = false;
    this.pointer.pointerId = null;
  };

  private onDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (!this.gyroEnabled || this.pointer.active) return;
    if (event.alpha == null || event.beta == null || event.gamma == null) {
      return;
    }

    if (!this.gyroBaseline) {
      this.gyroBaseline = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      };
      return;
    }

    // Map device attitude deltas onto look angles for immersive phone navigation.
    const dAlpha = event.alpha - this.gyroBaseline.alpha;
    const dBeta = event.beta - this.gyroBaseline.beta;
    this.lon = (this.config?.startYaw ?? 0) - dAlpha;
    this.lat = clamp((this.config?.startPitch ?? 0) + dBeta * 0.65, -85, 85);
  };

  private resize = () => {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  };

  private tick = () => {
    if (this.disposed) return;
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private updateCamera() {
    const phi = THREE.MathUtils.degToRad(90 - this.lat);
    const theta = THREE.MathUtils.degToRad(this.lon);
    const target = new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    );
    this.camera.lookAt(target);
  }

  private async loadTexture(index: number): Promise<THREE.Texture> {
    const cached = this.textures.get(index);
    if (cached) return cached;

    const url = this.imageUrls[index];
    if (!url) {
      throw new Error(`Missing panoramic image at index ${index}`);
    }

    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      this.loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => reject(new Error(`Failed to load panorama: ${url}`)),
      );
    });

    this.textures.set(index, texture);
    return texture;
  }

  private async loadScene(
    index: number,
    { animate }: { animate: boolean },
  ): Promise<void> {
    try {
      const texture = await this.loadTexture(index);

      if (!animate) {
        this.applyTexture(texture);
        this.sceneIndex = index;
        this.rebuildHotspots();
        this.onSceneChange?.(index);
        return;
      }

      this.transitioning = true;
      await this.fadeOpacity(1, 0, TRANSITION_MS * 0.45);
      this.applyTexture(texture);
      this.sceneIndex = index;
      this.rebuildHotspots();
      this.onSceneChange?.(index);
      await this.fadeOpacity(0, 1, TRANSITION_MS * 0.55);
      this.transitioning = false;
    } catch (error) {
      this.transitioning = false;
      const message =
        error instanceof Error ? error.message : "Unable to load panorama";
      this.onError?.(message);
    }
  }

  private applyTexture(texture: THREE.Texture) {
    if (this.material.map && this.material.map !== texture) {
      // Keep prior textures cached for fast hotspot back-navigation.
    }
    this.material.map = texture;
    this.material.needsUpdate = true;
  }

  private fadeOpacity(from: number, to: number, duration: number) {
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const step = (now: number) => {
        if (this.disposed) {
          resolve();
          return;
        }
        const t = clamp((now - start) / duration, 0, 1);
        const eased = t * (2 - t);
        this.material.opacity = from + (to - from) * eased;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          this.material.opacity = to;
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  private sceneHotspots(): VrHotspot[] {
    const scene = this.config?.scenes?.[this.sceneIndex];
    const hotspots = scene?.hotspots ?? [];
    return hotspots.filter(
      (spot) =>
        Number.isFinite(spot.targetIndex) &&
        spot.targetIndex >= 0 &&
        spot.targetIndex < this.imageUrls.length &&
        spot.targetIndex !== this.sceneIndex,
    );
  }

  private clearHotspots() {
    for (const object of this.hotspotObjects) {
      this.hotspotGroup.remove(object);
      object.element.remove();
    }
    this.hotspotObjects = [];
    this.onHotspotFocus?.(null);
  }

  private rebuildHotspots() {
    this.clearHotspots();

    for (const spot of this.sceneHotspots()) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "vr-hotspot";
      el.style.pointerEvents = "auto";
      el.setAttribute(
        "aria-label",
        spot.label
          ? `Go to ${spot.label}`
          : `Go to scene ${spot.targetIndex + 1}`,
      );

      const pulse = document.createElement("span");
      pulse.className = "vr-hotspot__pulse";
      pulse.setAttribute("aria-hidden", "true");

      const core = document.createElement("span");
      core.className = "vr-hotspot__core";
      core.setAttribute("aria-hidden", "true");

      el.append(pulse, core);

      if (spot.label) {
        const label = document.createElement("span");
        label.className = "vr-hotspot__label";
        label.textContent = spot.label;
        el.append(label);
      }

      el.addEventListener("pointerenter", () => {
        this.onHotspotFocus?.(spot.label ?? `Scene ${spot.targetIndex + 1}`);
      });
      el.addEventListener("pointerleave", () => {
        this.onHotspotFocus?.(null);
      });
      el.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.goToScene(spot.targetIndex);
      });

      const object = new CSS2DObject(el);
      object.position.copy(hotspotWorldPosition(spot.yaw, spot.pitch));
      this.hotspotGroup.add(object);
      this.hotspotObjects.push(object);
    }
  }
}
