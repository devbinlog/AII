/**
 * AII Creative Engine — Scene viewport
 * Letterbox/pillarbox fit of a scene into a drawing surface. Shared by the
 * Canvas2D renderer and the Studio canvas editor so their coordinates agree.
 */

export interface SceneViewport {
  /** Surface pixels per scene unit */
  scale: number;
  /** Surface offset of the scene origin */
  offsetX: number;
  offsetY: number;
}

export function fitScene(surfaceWidth: number, surfaceHeight: number, sceneWidth: number, sceneHeight: number): SceneViewport {
  const scale = Math.min(surfaceWidth / sceneWidth, surfaceHeight / sceneHeight);
  return {
    scale,
    offsetX: (surfaceWidth - sceneWidth * scale) / 2,
    offsetY: (surfaceHeight - sceneHeight * scale) / 2,
  };
}
