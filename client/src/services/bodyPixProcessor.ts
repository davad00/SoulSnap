import * as bodyPix from '@tensorflow-models/body-pix';
import * as tf from '@tensorflow/tfjs';

let net: bodyPix.BodyPix | null = null;

export async function loadBodyPix() {
  if (!net) {
    await tf.ready();
    net = await bodyPix.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 0.75,
      quantBytes: 2
    });
    console.log('BodyPix loaded');
  }
  return net;
}

export async function drawWithBackgroundRemoved(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
) {
  if (!net) {
    await loadBodyPix();
  }
  
  const segmentation = await net!.segmentPerson(video, {
    flipHorizontal: true,
    internalResolution: 'medium',
    segmentationThreshold: 0.7
  });

  // Draw the mask directly to canvas
  const foregroundColor = { r: 0, g: 0, b: 0, a: 0 };
  const backgroundColor = { r: 0, g: 0, b: 0, a: 255 };
  const backgroundDarkeningMask = bodyPix.toMask(
    segmentation,
    foregroundColor,
    backgroundColor
  );

  const ctx = canvas.getContext('2d')!;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw the original video
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  // Apply the mask
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  const maskCtx = maskCanvas.getContext('2d')!;
  const imageData = new ImageData(
    new Uint8ClampedArray(backgroundDarkeningMask),
    canvas.width,
    canvas.height
  );
  maskCtx.putImageData(imageData, 0, 0);

  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
}
