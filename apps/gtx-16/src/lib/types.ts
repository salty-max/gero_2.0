export type SmoothingCtx = CanvasRenderingContext2D & {
  imageSmoothingEnabled?: boolean
  mozImageSmoothingEnabled?: boolean
  webkitImageSmoothingEnabled?: boolean
  msImageSmoothingEnabled?: boolean
}
