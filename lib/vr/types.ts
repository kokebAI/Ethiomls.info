/**
 * Virtual walkthrough config — aligns with Listing.virtualWalkthroughConfig JSON.
 * Scene array indexes map 1:1 to panoramicImageUrls.
 */
export type VrHotspot = {
  /** Horizontal angle in degrees (−180…180), relative to panorama forward. */
  yaw: number;
  /** Vertical angle in degrees (−90…90). */
  pitch: number;
  /** Target index into panoramicImageUrls. */
  targetIndex: number;
  label?: string;
};

export type VrSceneConfig = {
  label?: string;
  hotspots?: VrHotspot[];
};

export type VirtualWalkthroughConfig = {
  scenes?: VrSceneConfig[];
  /** Initial camera yaw when entering the first scene. */
  startYaw?: number;
  /** Initial camera pitch when entering the first scene. */
  startPitch?: number;
};

export type VrViewerProps = {
  /** Equirectangular panorama URLs from the listing repository. */
  panoramicImageUrls: string[];
  config?: VirtualWalkthroughConfig | null;
  initialIndex?: number;
  className?: string;
  /** Called whenever the active panorama index changes. */
  onSceneChange?: (index: number) => void;
};
