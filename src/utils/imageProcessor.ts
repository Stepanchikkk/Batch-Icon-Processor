/**
 * Удаляет фон с изображения используя remove.bg API
 * Примечание: Требуется API ключ. В демо-режиме просто возвращает исходное изображение.
 */
export async function removeBg(imageFile: File | Blob): Promise<Blob> {
  try {
    // В реальном приложении здесь был бы вызов API remove.bg
    // Для демо просто возвращаем исходное изображение
    // Пользователь может использовать изображения с уже удаленным фоном
    
    // Проверяем, есть ли у изображения прозрачность
    const hasTransparency = await checkTransparency(imageFile);
    
    if (hasTransparency) {
      return imageFile;
    }
    
    // Простое удаление белого фона (базовая реализация)
    return await simpleBackgroundRemoval(imageFile);
  } catch (error) {
    console.error('Ошибка удаления фона:', error);
    // Возвращаем исходное изображение
    return imageFile;
  }
}

/**
 * Проверяет наличие прозрачности в изображении
 */
async function checkTransparency(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Проверяем наличие пикселей с прозрачностью
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) {
          resolve(true);
          URL.revokeObjectURL(img.src);
          return;
        }
      }
      
      resolve(false);
      URL.revokeObjectURL(img.src);
    };
    
    img.onerror = () => resolve(false);
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Простое удаление светлого фона (белый, серый)
 */
async function simpleBackgroundRemoval(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context error'));
        return;
      }
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Удаляем светлые пиксели (простой алгоритм)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Если пиксель светлый (почти белый/серый)
        const brightness = (r + g + b) / 3;
        if (brightness > 240) {
          data[i + 3] = 0; // Делаем прозрачным
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      canvas.toBlob((resultBlob) => {
        if (resultBlob) {
          resolve(resultBlob);
        } else {
          reject(new Error('Failed to create blob'));
        }
        URL.revokeObjectURL(img.src);
      }, 'image/png');
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
      URL.revokeObjectURL(img.src);
    };
    
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Накладывает иконку без фона на подложку
 */
export async function overlayOnBackground(
  iconBlob: Blob,
  backgroundImage: HTMLImageElement,
  iconScale: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Не удалось создать canvas context'));
      return;
    }

    // Размер подложки
    const bgSize = backgroundImage.width;
    canvas.width = bgSize;
    canvas.height = bgSize;

    // Рисуем подложку
    ctx.drawImage(backgroundImage, 0, 0, bgSize, bgSize);

    // Загружаем иконку без фона
    const iconImg = new Image();
    iconImg.onload = () => {
      // Вычисляем размер иконки с сохранением пропорций
      const iconTargetSize = bgSize * iconScale;
      const iconRatio = iconImg.width / iconImg.height;
      
      let iconWidth, iconHeight;
      if (iconRatio > 1) {
        // Горизонтальная
        iconWidth = iconTargetSize;
        iconHeight = iconTargetSize / iconRatio;
      } else {
        // Вертикальная или квадратная
        iconHeight = iconTargetSize;
        iconWidth = iconTargetSize * iconRatio;
      }

      // Центрируем
      const offsetX = (bgSize - iconWidth) / 2;
      const offsetY = (bgSize - iconHeight) / 2;

      // Рисуем иконку
      ctx.drawImage(iconImg, offsetX, offsetY, iconWidth, iconHeight);

      // Конвертируем в blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Не удалось создать результат'));
        }
      }, 'image/png');
    };

    iconImg.onerror = () => {
      reject(new Error('Не удалось загрузить иконку'));
    };

    iconImg.src = URL.createObjectURL(iconBlob);
  });
}

/**
 * Загружает изображение по URL
 */
export async function downloadImage(url: string): Promise<Blob> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Ошибка загрузки:', error);
    throw new Error('Не удалось скачать изображение');
  }
}

/**
 * Создаёт HTML Image элемент из Blob
 */
export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Не удалось загрузить изображение'));
    };
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Скачивает файл на компьютер пользователя
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
