/**
 * Утилиты для удаления подложки с иконок
 */

export interface ProcessingOptions {
  threshold?: number; // Порог прозрачности (0-255)
  edgeSmoothing?: boolean; // Сглаживание краёв
  targetBackgroundColor?: string; // Цвет подложки для удаления
  edgeCleanup?: boolean; // Агрессивная очистка краёв от артефактов
  erodePixels?: number; // Количество пикселей для эрозии (убирает обводку)
  removeLightEdges?: boolean; // Удалять светлые полупрозрачные края
  removeLiquidGlass?: boolean; // Удалять светлую обводку liquid glass
  glassOutlineWidth?: number; // Ширина обводки (1-5 пикселей)
  glassBrightness?: number; // Яркость обводки для удаления (0-255)
}

/**
 * Удаляет подложку с изображения, оставляя только иконку
 * Работает путём вычитания эталонной подложки или по цвету
 */
export async function removeBackground(
  imageFile: File,
  referenceBackground?: File,
  options: ProcessingOptions = {}
): Promise<Blob> {
  const {
    threshold = 30,
    edgeSmoothing = true,
    targetBackgroundColor,
    edgeCleanup = false,
    erodePixels = 0,
    removeLightEdges = false,
    removeLiquidGlass = false,
    glassOutlineWidth = 2,
    glassBrightness = 200,
  } = options;

  // Загружаем изображение
  const img = await loadImage(imageFile);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) throw new Error('Canvas context not available');

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Если есть эталонная подложка, используем её для вычитания
  if (referenceBackground) {
    const bgImg = await loadImage(referenceBackground);
    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!bgCtx) throw new Error('Background canvas context not available');
    
    bgCanvas.width = bgImg.width;
    bgCanvas.height = bgImg.height;
    bgCtx.drawImage(bgImg, 0, 0);
    
    const bgData = bgCtx.getImageData(0, 0, bgCanvas.width, bgCanvas.height);
    
    // Вычитаем подложку
    await subtractBackground(imageData, bgData, threshold);
  } else if (targetBackgroundColor) {
    // Удаляем по цвету
    const rgb = hexToRgb(targetBackgroundColor);
    removeByColor(imageData, rgb, threshold);
  } else {
    // Пытаемся определить цвет подложки автоматически
    const bgColor = detectBackgroundColor(imageData);
    removeByColor(imageData, bgColor, threshold);
  }

  // Применяем сглаживание краёв
  if (edgeSmoothing) {
    smoothEdges(imageData);
  }

  // Агрессивная очистка краёв от светлых артефактов
  if (removeLightEdges) {
    removeLightEdgeArtifacts(imageData);
  }

  // Эрозия - убирает пиксели по краям (удаляет обводку)
  if (erodePixels > 0) {
    erodeEdges(imageData, erodePixels);
  }

  // Дополнительная очистка краёв
  if (edgeCleanup) {
    aggressiveEdgeCleanup(imageData);
  }

  // Удаление светлой обводки liquid glass
  if (removeLiquidGlass) {
    removeLiquidGlassOutline(imageData, glassOutlineWidth, glassBrightness);
  }

  ctx.putImageData(imageData, 0, 0);

  // Конвертируем в PNG blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else throw new Error('Failed to create blob');
    }, 'image/png');
  });
}

/**
 * Загружает изображение из File
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Вычитает эталонную подложку из изображения
 * НОВАЯ ЛОГИКА: Удаляет ВСЁ что есть на эталоне (включая обводку!)
 * 
 * Принцип: Если на эталоне пиксель непрозрачный - значит это часть подложки.
 * Если цвет на иконке похож на цвет эталона в этой точке - удаляем ПОЛНОСТЬЮ.
 */
async function subtractBackground(
  imageData: ImageData,
  bgData: ImageData,
  threshold: number
): Promise<void> {
  const data = imageData.data;
  const bgPixels = bgData.data;

  // Нормализуем порог (1-100) в рабочий диапазон
  const workingThreshold = threshold * 2.55; // 0-255

  for (let i = 0; i < data.length; i += 4) {
    const bgAlpha = bgPixels[i + 3]; // Альфа эталона
    
    // КЛЮЧЕВОЕ: Если на эталоне есть ЛЮБОЙ пиксель (alpha > 0) - это часть подложки!
    if (bgAlpha > 0) {
      const bgR = bgPixels[i];
      const bgG = bgPixels[i + 1];
      const bgB = bgPixels[i + 2];

      const imgR = data[i];
      const imgG = data[i + 1];
      const imgB = data[i + 2];

      // Вычисляем разницу цветов (максимум по каналам для точности)
      const rDiff = Math.abs(imgR - bgR);
      const gDiff = Math.abs(imgG - bgG);
      const bDiff = Math.abs(imgB - bgB);
      const maxDiff = Math.max(rDiff, gDiff, bDiff);

      // Учитываем прозрачность эталона
      const alphaFactor = bgAlpha / 255;
      
      // Эффективный порог с учётом непрозрачности эталона
      const effectiveThreshold = workingThreshold * alphaFactor;

      if (maxDiff < effectiveThreshold) {
        // Пиксель похож на эталон - ПОЛНОСТЬЮ УДАЛЯЕМ!
        // Никаких полупрозрачных остатков!
        data[i + 3] = 0;
      } else if (maxDiff < effectiveThreshold * 1.5) {
        // Переходная зона - плавное удаление для сглаживания краёв иконки
        const fadeout = (maxDiff - effectiveThreshold) / (effectiveThreshold * 0.5);
        data[i + 3] = Math.round(data[i + 3] * fadeout);
      }
      // Если разница большая - пиксель принадлежит иконке, НЕ ТРОГАЕМ
    }
  }
}

/**
 * Удаляет фон по цвету
 */
function removeByColor(
  imageData: ImageData,
  targetColor: { r: number; g: number; b: number },
  threshold: number
): void {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const rDiff = Math.abs(r - targetColor.r);
    const gDiff = Math.abs(g - targetColor.g);
    const bDiff = Math.abs(b - targetColor.b);

    const totalDiff = (rDiff + gDiff + bDiff) / 3;

    if (totalDiff < threshold) {
      data[i + 3] = 0;
    } else {
      const alpha = Math.min(255, (totalDiff / threshold) * 255);
      data[i + 3] = Math.min(data[i + 3], alpha);
    }
  }
}

/**
 * Определяет цвет фона (берём углы изображения)
 */
function detectBackgroundColor(imageData: ImageData): {
  r: number;
  g: number;
  b: number;
} {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Берём 4 угла и центр краёв
  const samples = [
    0, // Левый верхний
    (width - 1) * 4, // Правый верхний
    (height - 1) * width * 4, // Левый нижний
    ((height - 1) * width + (width - 1)) * 4, // Правый нижний
  ];

  let r = 0,
    g = 0,
    b = 0;

  for (const idx of samples) {
    r += data[idx];
    g += data[idx + 1];
    b += data[idx + 2];
  }

  return {
    r: Math.round(r / samples.length),
    g: Math.round(g / samples.length),
    b: Math.round(b / samples.length),
  };
}

/**
 * Сглаживает края для более красивого результата
 */
function smoothEdges(imageData: ImageData): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Создаём копию данных
  const originalData = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // Если пиксель частично прозрачный
      if (originalData[idx + 3] > 0 && originalData[idx + 3] < 255) {
        // Усредняем с соседями
        let alphaSum = 0;
        let count = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
            alphaSum += originalData[neighborIdx + 3];
            count++;
          }
        }

        data[idx + 3] = Math.round(alphaSum / count);
      }
    }
  }
}

/**
 * Конвертирует HEX в RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

/**
 * Удаляет светлые полупрозрачные края (частые артефакты)
 * ВАЖНО: Работает ТОЛЬКО по внешнему периметру иконки, не внутри!
 */
function removeLightEdgeArtifacts(imageData: ImageData): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Сначала находим внешний край иконки
  const isOuterEdge = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      
      // Если пиксель непрозрачный или полупрозрачный
      if (data[pixelIdx + 3] > 0) {
        // Проверяем соседей - есть ли рядом полностью прозрачные
        let hasTransparent = false;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (data[nIdx + 3] === 0) {
              hasTransparent = true;
              break;
            }
          }
          if (hasTransparent) break;
        }
        
        // Это внешний край - рядом есть прозрачность
        if (hasTransparent) {
          isOuterEdge[idx] = 1;
        }
      }
    }
  }

  // Теперь обрабатываем ТОЛЬКО внешние края
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Обрабатываем только внешний край
      if (isOuterEdge[idx] !== 1) continue;
      
      const pixelIdx = idx * 4;
      const alpha = data[pixelIdx + 3];
      
      // Если пиксель полупрозрачный
      if (alpha > 0 && alpha < 200) {
        const r = data[pixelIdx];
        const g = data[pixelIdx + 1];
        const b = data[pixelIdx + 2];
        
        // Вычисляем яркость
        const brightness = (r + g + b) / 3;
        
        // Если это светлый полупрозрачный пиксель на краю - скорее всего артефакт
        if (brightness > 180) {
          // Уменьшаем альфа пропорционально яркости
          data[pixelIdx + 3] = Math.max(0, alpha - (brightness - 128));
        }
      }
    }
  }
}

/**
 * Эрозия - убирает пиксели по краям (удаляет тонкую обводку)
 */
function erodeEdges(imageData: ImageData, pixels: number): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // Создаём копию альфа-канала
  const alphaMap = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    alphaMap[i / 4] = data[i + 3];
  }

  // Проходим несколько раз для эрозии
  for (let pass = 0; pass < pixels; pass++) {
    const tempAlpha = new Uint8ClampedArray(alphaMap);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // Если это край (рядом есть прозрачные пиксели)
        if (tempAlpha[idx] > 0) {
          let hasTransparent = false;

          // Проверяем 8 соседей
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const neighborIdx = (y + dy) * width + (x + dx);
              if (tempAlpha[neighborIdx] === 0) {
                hasTransparent = true;
                break;
              }
            }
            if (hasTransparent) break;
          }

          // Если это край - делаем прозрачным
          if (hasTransparent) {
            alphaMap[idx] = 0;
          }
        }
      }
    }
  }

  // Применяем изменения
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] = alphaMap[i / 4];
  }
}

/**
 * Агрессивная очистка краёв - убирает все сомнительные пиксели
 */
function aggressiveEdgeCleanup(imageData: ImageData): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];

      // Если пиксель частично прозрачный (скорее всего артефакт)
      if (alpha > 0 && alpha < 128) {
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Проверяем соседей - есть ли рядом непрозрачные пиксели
        let hasOpaque = false;
        let opaqueCount = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const ny = y + dy;
            const nx = x + dx;
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nIdx = (ny * width + nx) * 4;
              if (data[nIdx + 3] > 200) {
                hasOpaque = true;
                opaqueCount++;
              }
            }
          }
        }

        // Если вокруг мало непрозрачных пикселей и пиксель светлый - убираем
        const brightness = (r + g + b) / 3;
        if ((!hasOpaque || opaqueCount < 3) && brightness > 150) {
          data[idx + 3] = 0;
        }
      }
    }
  }
}

/**
 * Удаляет светлую обводку в стиле liquid glass с краёв иконки
 * Специально для обработки иконок с подложкой, имеющей светлый контур
 * ВАЖНО: Работает ТОЛЬКО по ВНЕШНЕМУ периметру иконки, никогда внутри!
 */
function removeLiquidGlassOutline(
  imageData: ImageData,
  outlineWidth: number,
  brightThreshold: number
): void {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  // ШАГ 1: Находим ВНЕШНИЙ край иконки (граница с полной прозрачностью)
  const isOuterEdge = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      
      // Если пиксель непрозрачный или полупрозрачный
      if (data[pixelIdx + 3] > 0) {
        // Проверяем соседей - есть ли рядом ПОЛНОСТЬЮ прозрачные
        let hasFullyTransparent = false;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (data[nIdx + 3] === 0) {
              hasFullyTransparent = true;
              break;
            }
          }
          if (hasFullyTransparent) break;
        }
        
        if (hasFullyTransparent) {
          isOuterEdge[idx] = 1;
        }
      }
    }
  }

  // ШАГ 2: Расширяем зону обработки на outlineWidth пикселей ВНУТРЬ от края
  const processZone = new Uint8Array(width * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Проверяем, находится ли пиксель в зоне обработки (близко к внешнему краю)
      for (let dy = -outlineWidth; dy <= outlineWidth; dy++) {
        for (let dx = -outlineWidth; dx <= outlineWidth; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            if (isOuterEdge[ny * width + nx] === 1) {
              processZone[idx] = 1;
              break;
            }
          }
        }
        if (processZone[idx] === 1) break;
      }
    }
  }

  // ШАГ 3: Обрабатываем ТОЛЬКО пиксели в зоне внешнего края
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Пропускаем пиксели вне зоны обработки
      if (processZone[idx] !== 1) continue;
      
      const pixelIdx = idx * 4;
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const a = data[pixelIdx + 3];
      
      // Пропускаем полностью прозрачные
      if (a === 0) continue;
      
      // Вычисляем яркость
      const brightness = (r + g + b) / 3;
      
      // Удаляем светлые пиксели на внешнем крае (обводка liquid glass)
      if (brightness > brightThreshold) {
        // Чем светлее пиксель - тем сильнее уменьшаем альфа
        const brightFactor = (brightness - brightThreshold) / (255 - brightThreshold);
        const alphaReduction = brightFactor * a;
        data[pixelIdx + 3] = Math.max(0, a - alphaReduction);
      }
      
      // Полупрозрачные светлые пиксели на краю - тоже артефакты
      if (a > 0 && a < 180 && brightness > brightThreshold - 20) {
        data[pixelIdx + 3] = Math.max(0, Math.floor(a * 0.3));
      }
    }
  }
}

/**
 * Создаёт preview изображения
 */
export async function createPreview(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}
