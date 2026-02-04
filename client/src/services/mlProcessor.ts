import * as tf from '@tensorflow/tfjs';
import * as bodySegmentation from '@tensorflow-models/body-segmentation';

let segmenter: bodySegmentation.BodySegmenter | null = null;

export async function initModels() {
  if (!segmenter) {
    await tf.ready();
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    segmenter = await bodySegmentation.createSegmenter(model, {
      runtime: 'tfjs',
      modelType: 'general'
    });
  }
}

export async function processFrame(imageData: ImageData) {
  await initModels();
  
  if (!segmenter) {
    return { foreground: imageData, depthMap: null };
  }

  try {
    const segmentation = await segmenter.segmentPeople(imageData);
    
    if (!segmentation || segmentation.length === 0) {
      return { foreground: imageData, depthMap: null };
    }

    // Create binary mask - foreground should be white (255), background black (0)
    const foreground = await bodySegmentation.toBinaryMask(
      segmentation,
      { r: 255, g: 255, b: 255, a: 255 }, // Person = white/opaque
      { r: 0, g: 0, b: 0, a: 0 }           // Background = transparent
    );

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    
    // Draw original image
    ctx.putImageData(imageData, 0, 0);
    
    // Create mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imageData.width;
    maskCanvas.height = imageData.height;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.putImageData(foreground, 0, 0);
    
    // Use mask to cut out the person
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0);
    
    const result = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const depthMap = generateSimpleDepthMap(segmentation, imageData.width, imageData.height);
    
    return { foreground: result, depthMap };
  } catch (error) {
    console.error('Error processing frame:', error);
    return { foreground: imageData, depthMap: null };
  }
}

function generateSimpleDepthMap(
  segmentation: bodySegmentation.Segmentation[],
  width: number,
  height: number
): ImageData | null {
  const depthData = new Uint8ClampedArray(width * height * 4);
  
  try {
    if (segmentation && segmentation.length > 0 && segmentation[0].mask) {
      const mask = segmentation[0].mask;
      
      // Handle different mask formats
      let maskData: Uint8ClampedArray | null = null;
      
      if (typeof mask.toImageData === 'function') {
        maskData = mask.toImageData().data;
      } else if (mask instanceof ImageData) {
        maskData = mask.data;
      } else if (mask.data && mask.data.length) {
        maskData = mask.data;
      }
      
      if (maskData && maskData.length > 0) {
        for (let i = 0; i < maskData.length && i < depthData.length; i += 4) {
          const alpha = maskData[i + 3] !== undefined ? maskData[i + 3] : maskData[i];
          const depth = alpha > 128 ? 200 : 50;
          
          depthData[i] = depth;
          depthData[i + 1] = depth;
          depthData[i + 2] = depth;
          depthData[i + 3] = 255;
        }
      } else {
        // Fallback: create simple depth map
        for (let i = 0; i < depthData.length; i += 4) {
          depthData[i] = depthData[i + 1] = depthData[i + 2] = 128;
          depthData[i + 3] = 255;
        }
      }
    } else {
      // No segmentation, create neutral depth map
      for (let i = 0; i < depthData.length; i += 4) {
        depthData[i] = depthData[i + 1] = depthData[i + 2] = 128;
        depthData[i + 3] = 255;
      }
    }
    
    return new ImageData(depthData, width, height);
  } catch (error) {
    console.error('Error generating depth map:', error);
    // Return neutral depth map on error
    for (let i = 0; i < depthData.length; i += 4) {
      depthData[i] = depthData[i + 1] = depthData[i + 2] = 128;
      depthData[i + 3] = 255;
    }
    return new ImageData(depthData, width, height);
  }
}
