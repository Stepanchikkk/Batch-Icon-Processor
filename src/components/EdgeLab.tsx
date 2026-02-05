import { useState, useRef, useCallback, useEffect } from 'react';

interface EdgeLabProps {}

type Method = 'none' | 'gaussian' | 'supersampling' | 'morphological' | 'subpixel' | 'vector' | 'edgeBezier' | 'blur-sharpen';

export function EdgeLab({}: EdgeLabProps) {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Методы
  const [method, setMethod] = useState<Method>('supersampling');
  
  // Общие настройки
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [showOnBackground, setShowOnBackground] = useState(true);
  
  // Supersampling
  const [supersampleScale, setSupersampleScale] = useState(4);
  
  // Gaussian blur
  const [gaussianRadius, setGaussianRadius] = useState(2);
  const [gaussianPasses, setGaussianPasses] = useState(2);
  
  // Morphological
  const [dilateRadius, setDilateRadius] = useState(1);
  const [erodeRadius, setErodeRadius] = useState(1);
  
  // Subpixel
  const [subpixelThreshold, setSubpixelThreshold] = useState(128);
  const [subpixelSmooth, setSubpixelSmooth] = useState(0.5);
  const [subpixelSharpness, setSubpixelSharpness] = useState(100);
  
  // Vector
  const [vectorColors, setVectorColors] = useState(16);
  const [vectorBlur, setVectorBlur] = useState(0);
  
  // Edge Bezier
  const [edgeBezierRadius, setEdgeBezierRadius] = useState(2);
  const [edgeBezierStrength, setEdgeBezierStrength] = useState(0.7);

  // Blur + Sharpen
  const [blurRadius, setBlurRadius] = useState(2);
  const [sharpenStrength, setSharpenStrength] = useState(150);
  const [sharpenThreshold, setSharpenThreshold] = useState(10);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // Обработка изображения
  const processImage = useCallback(async () => {
    if (!originalImage) return;
    
    setIsProcessing(true);
    
    try {
      const img = new Image();
      img.src = originalImage;
      await new Promise(resolve => img.onload = resolve);
      
      let result: ImageData;
      
      switch (method) {
        case 'supersampling':
          result = await supersamplingMethod(img, supersampleScale);
          break;
        case 'gaussian':
          result = await gaussianMethod(img, gaussianRadius, gaussianPasses);
          break;
        case 'morphological':
          result = await morphologicalMethod(img, dilateRadius, erodeRadius);
          break;
        case 'subpixel':
          result = await subpixelMethod(img, subpixelThreshold, subpixelSmooth, subpixelSharpness);
          break;
        case 'vector':
          result = await vectorMethod(img, vectorColors, vectorBlur);
          break;
        case 'edgeBezier':
          result = await edgeBezierMethod(img, edgeBezierRadius, edgeBezierStrength);
          break;
        case 'blur-sharpen':
          result = await blurSharpenMethod(img, blurRadius, sharpenStrength, sharpenThreshold);
          break;
        default:
          result = await noProcessing(img);
      }
      
      // Конвертируем в dataURL
      const canvas = document.createElement('canvas');
      canvas.width = result.width;
      canvas.height = result.height;
      const ctx = canvas.getContext('2d')!;
      ctx.putImageData(result, 0, 0);
      
      setProcessedImage(canvas.toDataURL('image/png'));
    } catch (err) {
      console.error('Processing error:', err);
    }
    
    setIsProcessing(false);
  }, [originalImage, method, supersampleScale, gaussianRadius, gaussianPasses, dilateRadius, erodeRadius, subpixelThreshold, subpixelSmooth]);

  // Автообработка при изменении параметров
  useEffect(() => {
    if (originalImage) {
      const timer = setTimeout(processImage, 300);
      return () => clearTimeout(timer);
    }
  }, [originalImage, method, supersampleScale, gaussianRadius, gaussianPasses, dilateRadius, erodeRadius, subpixelThreshold, subpixelSmooth, subpixelSharpness, vectorColors, vectorBlur, edgeBezierRadius, edgeBezierStrength, blurRadius, sharpenStrength, sharpenThreshold]);

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">🧪 Лаборатория краёв</h1>
        <p className="text-gray-400">Эксперименты с методами сглаживания</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка - загрузка и методы */}
        <div className="space-y-4">
          {/* Загрузка */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Тестовое изображение</h3>
            <div
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-gray-500 transition"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-gray-400 text-sm">
                {originalImage ? 'Заменить изображение' : 'Выберите или перетащите PNG без фона'}
              </p>
            </div>
          </div>

          {/* Выбор метода */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Метод обработки</h3>
            <div className="space-y-2">
              {[
                { id: 'none', name: 'Без обработки', desc: 'Исходные края' },
                { id: 'supersampling', name: '🎯 Supersampling', desc: 'Увеличение → обработка → уменьшение' },
                { id: 'blur-sharpen', name: '✨ Blur + Sharpen', desc: 'Размытие + повышение резкости краёв' },
                { id: 'edgeBezier', name: '✨ Edge Bezier', desc: 'Сглаживание только контура кривыми' },
                { id: 'gaussian', name: 'Gaussian Blur', desc: 'Размытие альфа-канала' },
                { id: 'morphological', name: 'Морфология', desc: 'Dilate + Erode' },
                { id: 'subpixel', name: 'Subpixel', desc: 'Субпиксельное сглаживание' },
                { id: 'vector', name: '✨ Векторизация', desc: 'Трассировка в вектор → рендер обратно' },
              ].map(m => (
                <label
                  key={m.id}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition ${
                    method === m.id 
                      ? 'bg-blue-600/20 border border-blue-500/50' 
                      : 'hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={method === m.id}
                    onChange={() => setMethod(m.id as Method)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-white">{m.name}</div>
                    <div className="text-xs text-gray-400">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Настройки метода */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Параметры</h3>
            
            {method === 'supersampling' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Масштаб</span>
                    <span className="text-white">{supersampleScale}x</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="8"
                    value={supersampleScale}
                    onChange={e => setSupersampleScale(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Больше = качественнее края, но медленнее
                  </p>
                </div>
              </div>
            )}

            {method === 'gaussian' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Радиус</span>
                    <span className="text-white">{gaussianRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={gaussianRadius}
                    onChange={e => setGaussianRadius(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Проходов</span>
                    <span className="text-white">{gaussianPasses}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={gaussianPasses}
                    onChange={e => setGaussianPasses(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}

            {method === 'morphological' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Dilate (расширение)</span>
                    <span className="text-white">{dilateRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={dilateRadius}
                    onChange={e => setDilateRadius(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Erode (сужение)</span>
                    <span className="text-white">{erodeRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={erodeRadius}
                    onChange={e => setErodeRadius(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Dilate расширяет края, Erode сужает. Комбинация сглаживает.
                </p>
              </div>
            )}

            {method === 'subpixel' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Порог</span>
                    <span className="text-white">{subpixelThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="254"
                    value={subpixelThreshold}
                    onChange={e => setSubpixelThreshold(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Сглаживание</span>
                    <span className="text-white">{(subpixelSmooth * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={subpixelSmooth * 100}
                    onChange={e => setSubpixelSmooth(Number(e.target.value) / 100)}
                    className="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Резкость</span>
                    <span className="text-white">{subpixelSharpness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={subpixelSharpness}
                    onChange={e => setSubpixelSharpness(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Усиление контраста краёв (100 = без изменений)
                  </p>
                </div>
              </div>
            )}

            {method === 'vector' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Количество цветов</span>
                    <span className="text-white">{vectorColors}</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="64"
                    value={vectorColors}
                    onChange={e => setVectorColors(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Меньше = проще края, больше = детальнее
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Размытие перед трассировкой</span>
                    <span className="text-white">{vectorBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={vectorBlur}
                    onChange={e => setVectorBlur(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}

            {method === 'edgeBezier' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Радиус обнаружения краёв</span>
                    <span className="text-white">{edgeBezierRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={edgeBezierRadius}
                    onChange={e => setEdgeBezierRadius(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Сколько пикселей от края обрабатывать
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Сила сглаживания</span>
                    <span className="text-white">{Math.round(edgeBezierStrength * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={edgeBezierStrength * 100}
                    onChange={e => setEdgeBezierStrength(Number(e.target.value) / 100)}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Насколько сильно сглаживать кривые
                  </p>
                </div>
                <div className="bg-blue-900/30 p-3 rounded text-xs text-blue-300">
                  💡 Этот метод находит только контур и сглаживает его кривыми Безье. Внутренность иконки не меняется.
                </div>
              </div>
            )}

            {method === 'blur-sharpen' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Радиус размытия</span>
                    <span className="text-white">{blurRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={blurRadius}
                    onChange={e => setBlurRadius(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Чем больше - тем мягче края (1-2 для начала)
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Сила резкости</span>
                    <span className="text-white">{sharpenStrength}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    value={sharpenStrength}
                    onChange={e => setSharpenStrength(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Усиление контраста после размытия (100-200 оптимально)
                  </p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Порог</span>
                    <span className="text-white">{sharpenThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={sharpenThreshold}
                    onChange={e => setSharpenThreshold(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Минимальная разница для обработки (защита от артефактов)
                  </p>
                </div>
                <div className="bg-blue-900/30 p-3 rounded text-xs text-blue-300">
                  💡 Рекомендуемые настройки: Blur 1.5-2px, Sharpen 120-150%, Threshold 10
                </div>
              </div>
            )}

            {method === 'none' && (
              <p className="text-sm text-gray-500">Нет параметров</p>
            )}
          </div>

          {/* Цвет фона */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Предпросмотр</h3>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnBackground}
                  onChange={e => setShowOnBackground(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-400">На фоне</span>
              </label>
              <input
                type="color"
                value={backgroundColor}
                onChange={e => setBackgroundColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
                disabled={!showOnBackground}
              />
            </div>
          </div>
        </div>

        {/* Правая колонка - предпросмотр */}
        <div className="lg:col-span-2">
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300">Сравнение</h3>
              {isProcessing && (
                <span className="text-xs text-blue-400 animate-pulse">Обработка...</span>
              )}
            </div>

            {!originalImage ? (
              <div className="flex items-center justify-center h-64 text-gray-500">
                Загрузите изображение для тестирования
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Оригинал */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 text-center">Оригинал</p>
                  <div 
                    className="rounded-lg overflow-hidden flex items-center justify-center p-4"
                    style={{ 
                      backgroundColor: showOnBackground ? backgroundColor : 'transparent',
                      backgroundImage: !showOnBackground ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px' : 'none'
                    }}
                  >
                    <img 
                      src={originalImage} 
                      alt="Original" 
                      className="max-w-full max-h-64 object-contain"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                </div>

                {/* Обработанное */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 text-center">
                    {method === 'none' ? 'Без обработки' : method === 'supersampling' ? `Supersampling ${supersampleScale}x` : method}
                  </p>
                  <div 
                    className="rounded-lg overflow-hidden flex items-center justify-center p-4"
                    style={{ 
                      backgroundColor: showOnBackground ? backgroundColor : 'transparent',
                      backgroundImage: !showOnBackground ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px' : 'none'
                    }}
                  >
                    {processedImage ? (
                      <img 
                        src={processedImage} 
                        alt="Processed" 
                        className="max-w-full max-h-64 object-contain"
                      />
                    ) : (
                      <div className="text-gray-500 text-sm">Обработка...</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Zoom сравнение */}
            {originalImage && processedImage && (
              <div className="mt-6">
                <p className="text-xs text-gray-500 mb-2 text-center">Увеличение 4x (для анализа краёв)</p>
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="rounded-lg overflow-hidden flex items-center justify-center p-4"
                    style={{ 
                      backgroundColor: showOnBackground ? backgroundColor : 'transparent',
                      backgroundImage: !showOnBackground ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px' : 'none'
                    }}
                  >
                    <img 
                      src={originalImage} 
                      alt="Original zoomed" 
                      className="max-h-48 object-contain"
                      style={{ imageRendering: 'pixelated', transform: 'scale(4)', transformOrigin: 'center' }}
                    />
                  </div>
                  <div 
                    className="rounded-lg overflow-hidden flex items-center justify-center p-4"
                    style={{ 
                      backgroundColor: showOnBackground ? backgroundColor : 'transparent',
                      backgroundImage: !showOnBackground ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 20px 20px' : 'none'
                    }}
                  >
                    <img 
                      src={processedImage} 
                      alt="Processed zoomed" 
                      className="max-h-48 object-contain"
                      style={{ imageRendering: 'pixelated', transform: 'scale(4)', transformOrigin: 'center' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== МЕТОДЫ ОБРАБОТКИ ==========

async function noProcessing(img: HTMLImageElement): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

async function supersamplingMethod(img: HTMLImageElement, scale: number): Promise<ImageData> {
  const originalWidth = img.width;
  const originalHeight = img.height;
  
  // 1. Увеличиваем с bicubic интерполяцией
  const largeCanvas = document.createElement('canvas');
  largeCanvas.width = originalWidth * scale;
  largeCanvas.height = originalHeight * scale;
  const largeCtx = largeCanvas.getContext('2d')!;
  largeCtx.imageSmoothingEnabled = true;
  largeCtx.imageSmoothingQuality = 'high';
  largeCtx.drawImage(img, 0, 0, largeCanvas.width, largeCanvas.height);
  
  // 2. Обрабатываем на большом размере - делаем края чётче
  const largeData = largeCtx.getImageData(0, 0, largeCanvas.width, largeCanvas.height);
  
  // Убираем полупрозрачные пиксели на краях (делаем чётче)
  const threshold = 128;
  for (let i = 0; i < largeData.data.length; i += 4) {
    const alpha = largeData.data[i + 3];
    // Но оставляем градиент для антиалиасинга
    if (alpha > 0 && alpha < 255) {
      // Мягкий порог - усиливаем контраст, но сохраняем плавность
      const newAlpha = alpha < threshold 
        ? Math.floor(alpha * 0.5) 
        : Math.floor(alpha + (255 - alpha) * 0.5);
      largeData.data[i + 3] = newAlpha;
    }
  }
  largeCtx.putImageData(largeData, 0, 0);
  
  // 3. Уменьшаем обратно - браузер автоматически делает антиалиасинг
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = originalWidth;
  finalCanvas.height = originalHeight;
  const finalCtx = finalCanvas.getContext('2d')!;
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(largeCanvas, 0, 0, originalWidth, originalHeight);
  
  return finalCtx.getImageData(0, 0, originalWidth, originalHeight);
}

async function gaussianMethod(img: HTMLImageElement, radius: number, passes: number): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Gaussian kernel
  const kernel = generateGaussianKernel(radius);
  const kernelSize = radius * 2 + 1;
  
  for (let pass = 0; pass < passes; pass++) {
    const tempAlpha = new Uint8ClampedArray(width * height);
    
    // Копируем альфа
    for (let i = 0; i < width * height; i++) {
      tempAlpha[i] = data[i * 4 + 3];
    }
    
    // Размываем только альфа-канал
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const alpha = tempAlpha[idx];
        
        // Обрабатываем только краевые пиксели
        if (alpha > 10 && alpha < 245) {
          let sum = 0;
          let weightSum = 0;
          
          for (let ky = -radius; ky <= radius; ky++) {
            for (let kx = -radius; kx <= radius; kx++) {
              const nx = x + kx;
              const ny = y + ky;
              
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                const weight = kernel[(ky + radius) * kernelSize + (kx + radius)];
                sum += tempAlpha[nidx] * weight;
                weightSum += weight;
              }
            }
          }
          
          data[idx * 4 + 3] = Math.round(sum / weightSum);
        }
      }
    }
  }
  
  return imageData;
}

function generateGaussianKernel(radius: number): number[] {
  const size = radius * 2 + 1;
  const kernel = new Array(size * size);
  const sigma = radius / 2;
  let sum = 0;
  
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel[(y + radius) * size + (x + radius)] = value;
      sum += value;
    }
  }
  
  // Нормализуем
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }
  
  return kernel;
}

async function morphologicalMethod(img: HTMLImageElement, dilateR: number, erodeR: number): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Dilate (расширение)
  if (dilateR > 0) {
    imageData = morphOp(imageData, dilateR, 'dilate');
  }
  
  // Erode (сужение)
  if (erodeR > 0) {
    imageData = morphOp(imageData, erodeR, 'erode');
  }
  
  return imageData;
}

function morphOp(imageData: ImageData, radius: number, op: 'dilate' | 'erode'): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const result = new Uint8ClampedArray(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      let extremeAlpha = op === 'dilate' ? 0 : 255;
      
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = x + kx;
          const ny = y + ky;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = (ny * width + nx) * 4;
            const alpha = data[nidx + 3];
            
            if (op === 'dilate') {
              extremeAlpha = Math.max(extremeAlpha, alpha);
            } else {
              extremeAlpha = Math.min(extremeAlpha, alpha);
            }
          }
        }
      }
      
      result[idx + 3] = extremeAlpha;
    }
  }
  
  return new ImageData(result, width, height);
}

async function subpixelMethod(img: HTMLImageElement, _threshold: number, smooth: number, sharpness: number): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Работаем с копией альфа-канала
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alpha[i] = data[i * 4 + 3];
  }
  
  // Субпиксельное сглаживание - интерполяция между соседними значениями
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const a = alpha[idx];
      
      // Только для полупрозрачных пикселей
      if (a > 10 && a < 245) {
        // Среднее соседей
        const neighbors = [
          alpha[idx - 1], alpha[idx + 1],
          alpha[idx - width], alpha[idx + width]
        ];
        const avg = neighbors.reduce((s, v) => s + v, 0) / 4;
        
        // Интерполируем между текущим и средним
        const newAlpha = a * (1 - smooth) + avg * smooth;
        
        // Применяем мягкий порог
        data[idx * 4 + 3] = Math.round(newAlpha);
      }
    }
  }
  
  // Применяем резкость (Unsharp Mask) если sharpness != 100
  if (sharpness !== 100) {
    const sharpenFactor = (sharpness - 100) / 100; // -1 до +1
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const a = data[idx + 3];
        
        // Только для полупрозрачных/краевых пикселей
        if (a > 10 && a < 245) {
          // Вычисляем среднее соседей
          let sum = 0;
          let count = 0;
          
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nidx = ((y + dy) * width + (x + dx)) * 4;
              sum += data[nidx + 3];
              count++;
            }
          }
          
          const blurred = sum / count;
          const diff = a - blurred;
          
          // Усиливаем контраст
          const sharpened = a + diff * sharpenFactor;
          data[idx + 3] = Math.max(0, Math.min(255, Math.round(sharpened)));
        }
      }
    }
  }
  
  return imageData;
}

// Векторизация с использованием Canvas Path2D
async function vectorMethod(img: HTMLImageElement, numColors: number, blur: number): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  // Опционально размываем перед трассировкой
  if (blur > 0) {
    ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
  }
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // Квантизация цветов для упрощения
  const colorMap = quantizeColors(data, numColors);
  
  // Создаём новый canvas для рендеринга сглаженных краёв
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d')!;
  resultCtx.imageSmoothingEnabled = true;
  resultCtx.imageSmoothingQuality = 'high';
  
  // Находим контуры и рисуем их сглаженно
  const visited = new Set<number>();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      
      if (alpha > 128 && !visited.has(y * width + x)) {
        // Находим связанную область одного цвета
        const region = floodFill(data, width, height, x, y, colorMap, visited);
        
        if (region.length > 4) {
          // Получаем контур области
          const contour = getContour(region, width);
          
          if (contour.length > 2) {
            // Сглаживаем контур
            const smoothed = smoothContour(contour, 3);
            
            // Получаем средний цвет региона
            let r = 0, g = 0, b = 0, a = 0;
            for (const pt of region) {
              const i = pt * 4;
              r += data[i];
              g += data[i + 1];
              b += data[i + 2];
              a += data[i + 3];
            }
            r = Math.round(r / region.length);
            g = Math.round(g / region.length);
            b = Math.round(b / region.length);
            a = Math.round(a / region.length);
            
            // Рисуем сглаженный контур
            resultCtx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
            resultCtx.beginPath();
            resultCtx.moveTo(smoothed[0].x, smoothed[0].y);
            
            for (let i = 1; i < smoothed.length; i++) {
              const curr = smoothed[i];
              const next = smoothed[(i + 1) % smoothed.length];
              
              // Кривая Безье для сглаживания
              const cpx = curr.x;
              const cpy = curr.y;
              const endx = (curr.x + next.x) / 2;
              const endy = (curr.y + next.y) / 2;
              
              resultCtx.quadraticCurveTo(cpx, cpy, endx, endy);
            }
            
            resultCtx.closePath();
            resultCtx.fill();
          }
        }
      }
    }
  }
  
  return resultCtx.getImageData(0, 0, width, height);
}

function quantizeColors(data: Uint8ClampedArray, numColors: number): Map<string, string> {
  const colorMap = new Map<string, string>();
  const step = Math.floor(256 / Math.cbrt(numColors));
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const qr = Math.floor(r / step) * step;
    const qg = Math.floor(g / step) * step;
    const qb = Math.floor(b / step) * step;
    
    const key = `${r},${g},${b}`;
    const value = `${qr},${qg},${qb}`;
    colorMap.set(key, value);
  }
  
  return colorMap;
}

function floodFill(data: Uint8ClampedArray, width: number, height: number, startX: number, startY: number, colorMap: Map<string, string>, visited: Set<number>): number[] {
  const region: number[] = [];
  const stack: [number, number][] = [[startX, startY]];
  const startIdx = (startY * width + startX) * 4;
  const startColor = colorMap.get(`${data[startIdx]},${data[startIdx + 1]},${data[startIdx + 2]}`) || '';
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = y * width + x;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited.has(idx)) continue;
    
    const i = idx * 4;
    if (data[i + 3] < 128) continue;
    
    const color = colorMap.get(`${data[i]},${data[i + 1]},${data[i + 2]}`) || '';
    if (color !== startColor) continue;
    
    visited.add(idx);
    region.push(idx);
    
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return region;
}

function getContour(region: number[], width: number): { x: number; y: number }[] {
  const regionSet = new Set(region);
  const contour: { x: number; y: number }[] = [];
  
  for (const idx of region) {
    const x = idx % width;
    const y = Math.floor(idx / width);
    
    // Проверяем соседей
    const neighbors = [
      (y - 1) * width + x,
      (y + 1) * width + x,
      y * width + (x - 1),
      y * width + (x + 1)
    ];
    
    // Если хотя бы один сосед не в регионе - это граница
    if (neighbors.some(n => !regionSet.has(n))) {
      contour.push({ x, y });
    }
  }
  
  // Сортируем по углу от центра
  if (contour.length > 0) {
    const cx = contour.reduce((s, p) => s + p.x, 0) / contour.length;
    const cy = contour.reduce((s, p) => s + p.y, 0) / contour.length;
    contour.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  }
  
  return contour;
}

function smoothContour(contour: { x: number; y: number }[], windowSize: number): { x: number; y: number }[] {
  if (contour.length < windowSize) return contour;
  
  const result: { x: number; y: number }[] = [];
  const half = Math.floor(windowSize / 2);
  
  for (let i = 0; i < contour.length; i++) {
    let sx = 0, sy = 0;
    
    for (let j = -half; j <= half; j++) {
      const idx = (i + j + contour.length) % contour.length;
      sx += contour[idx].x;
      sy += contour[idx].y;
    }
    
    result.push({
      x: sx / windowSize,
      y: sy / windowSize
    });
  }
  
  return result;
}

// Edge Bezier - сглаживает ТОЛЬКО контур кривыми Безье, не трогая внутренность
async function edgeBezierMethod(img: HTMLImageElement, radius: number, strength: number): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  
  // 1. Находим все краевые пиксели (где alpha переходит от >200 к <50)
  const edgePixels: { x: number; y: number; alpha: number }[] = [];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const alpha = data[idx + 3];
      
      // Ищем пиксели на границе (полупрозрачные или рядом с прозрачными)
      if (alpha > 0) {
        // Проверяем соседей
        let hasTransparent = false;
        let hasOpaque = false;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = ((y + dy) * width + (x + dx)) * 4;
            const nalpha = data[nidx + 3];
            if (nalpha < 50) hasTransparent = true;
            if (nalpha > 200) hasOpaque = true;
          }
        }
        
        // Это краевой пиксель если рядом есть и прозрачные и непрозрачные
        if (hasTransparent && (alpha < 250 || hasOpaque)) {
          edgePixels.push({ x, y, alpha });
        }
      }
    }
  }
  
  if (edgePixels.length < 3) {
    return imageData; // Нет краёв для обработки
  }
  
  // 2. Группируем краевые пиксели в связанные контуры
  const contours = findContours(edgePixels, width);
  
  // 3. Создаём новый canvas для результата
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = width;
  resultCanvas.height = height;
  const resultCtx = resultCanvas.getContext('2d')!;
  
  // Копируем оригинал
  resultCtx.drawImage(canvas, 0, 0);
  
  // 4. Для каждого контура рисуем сглаженную версию
  for (const contour of contours) {
    if (contour.length < 4) continue;
    
    // Сортируем точки по углу относительно центра
    const cx = contour.reduce((s, p) => s + p.x, 0) / contour.length;
    const cy = contour.reduce((s, p) => s + p.y, 0) / contour.length;
    contour.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    
    // Сглаживаем контур (moving average)
    const smoothed = smoothContourPoints(contour, Math.ceil(radius * 2 + 1));
    
    // Интерполируем кривыми Безье
    if (smoothed.length >= 4) {
      // Очищаем область вокруг контура
      for (const pt of contour) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const px = pt.x + dx;
            const py = pt.y + dy;
            if (px >= 0 && px < width && py >= 0 && py < height) {
              const idx = (py * width + px) * 4;
              const origAlpha = data[idx + 3];
              // Очищаем только полупрозрачные пиксели
              if (origAlpha > 0 && origAlpha < 250) {
                resultCtx.clearRect(px, py, 1, 1);
              }
            }
          }
        }
      }
      
      // Рисуем сглаженный контур
      resultCtx.save();
      resultCtx.globalCompositeOperation = 'source-over';
      
      // Создаём градиентную маску для плавного перехода
      for (let pass = 0; pass < 3; pass++) {
        const alphaMultiplier = (pass + 1) / 3 * strength;
        
        resultCtx.beginPath();
        
        // Catmull-Rom → Bezier conversion для плавных кривых
        for (let i = 0; i < smoothed.length; i++) {
          const p0 = smoothed[(i - 1 + smoothed.length) % smoothed.length];
          const p1 = smoothed[i];
          const p2 = smoothed[(i + 1) % smoothed.length];
          const p3 = smoothed[(i + 2) % smoothed.length];
          
          if (i === 0) {
            resultCtx.moveTo(p1.x, p1.y);
          }
          
          // Catmull-Rom to Bezier control points
          const cp1x = p1.x + (p2.x - p0.x) / 6 * strength;
          const cp1y = p1.y + (p2.y - p0.y) / 6 * strength;
          const cp2x = p2.x - (p3.x - p1.x) / 6 * strength;
          const cp2y = p2.y - (p3.y - p1.y) / 6 * strength;
          
          resultCtx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
        
        resultCtx.closePath();
        
        // Рисуем с полупрозрачностью для антиалиасинга
        const avgColor = getAverageEdgeColor(data, contour, width);
        resultCtx.fillStyle = `rgba(${avgColor.r}, ${avgColor.g}, ${avgColor.b}, ${alphaMultiplier * 0.3})`;
        resultCtx.fill();
      }
      
      resultCtx.restore();
    }
  }
  
  return resultCtx.getImageData(0, 0, width, height);
}

function findContours(pixels: { x: number; y: number; alpha: number }[], _width: number): { x: number; y: number; alpha: number }[][] {
  const contours: { x: number; y: number; alpha: number }[][] = [];
  const visited = new Set<string>();
  
  for (const pixel of pixels) {
    const key = `${pixel.x},${pixel.y}`;
    if (visited.has(key)) continue;
    
    // BFS для поиска связанных пикселей
    const contour: { x: number; y: number; alpha: number }[] = [];
    const queue = [pixel];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = `${current.x},${current.y}`;
      
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);
      contour.push(current);
      
      // Ищем соседей
      for (const neighbor of pixels) {
        const nkey = `${neighbor.x},${neighbor.y}`;
        if (visited.has(nkey)) continue;
        
        const dist = Math.abs(neighbor.x - current.x) + Math.abs(neighbor.y - current.y);
        if (dist <= 2) {
          queue.push(neighbor);
        }
      }
    }
    
    if (contour.length >= 4) {
      contours.push(contour);
    }
  }
  
  return contours;
}

function smoothContourPoints(points: { x: number; y: number }[], windowSize: number): { x: number; y: number }[] {
  if (points.length < windowSize) return points;
  
  const result: { x: number; y: number }[] = [];
  const half = Math.floor(windowSize / 2);
  
  for (let i = 0; i < points.length; i++) {
    let sx = 0, sy = 0, count = 0;
    
    for (let j = -half; j <= half; j++) {
      const idx = (i + j + points.length) % points.length;
      // Gaussian-like weight
      const weight = 1 - Math.abs(j) / (half + 1);
      sx += points[idx].x * weight;
      sy += points[idx].y * weight;
      count += weight;
    }
    
    result.push({
      x: sx / count,
      y: sy / count
    });
  }
  
  return result;
}

function getAverageEdgeColor(data: Uint8ClampedArray, contour: { x: number; y: number }[], width: number): { r: number; g: number; b: number } {
  let r = 0, g = 0, b = 0, count = 0;
  
  for (const pt of contour) {
    const idx = (pt.y * width + pt.x) * 4;
    if (data[idx + 3] > 100) { // Только достаточно непрозрачные
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }
  
  if (count === 0) return { r: 128, g: 128, b: 128 };
  
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  };
}

// Blur + Sharpen method
async function blurSharpenMethod(
  img: HTMLImageElement,
  blurRadius: number,
  sharpenStrength: number,
  threshold: number
): Promise<ImageData> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Blur edges first
  imageData = blurEdgesPass(imageData, blurRadius);
  
  // Then sharpen
  imageData = sharpenEdgesPass(imageData, sharpenStrength, threshold);
  
  return imageData;
}

function blurEdgesPass(imageData: ImageData, radius: number): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  const isEdge = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      const alpha = data[pixelIdx + 3];
      
      if (alpha > 0) {
        let hasTransparent = false;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = ((y + dy) * width + (x + dx)) * 4;
            if (data[nidx + 3] === 0) {
              hasTransparent = true;
              break;
            }
          }
          if (hasTransparent) break;
        }
        if (hasTransparent) isEdge[idx] = 1;
      }
    }
  }
  
  const kernel = gaussianKernel(radius);
  const kernelSize = radius * 2 + 1;
  const newAlpha = new Uint8ClampedArray(width * height);
  
  for (let i = 0; i < width * height; i++) {
    newAlpha[i] = data[i * 4 + 3];
  }
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = y * width + x;
      if (isEdge[idx] === 1) {
        let sum = 0;
        let weightSum = 0;
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nidx = (y + ky) * width + (x + kx);
            const weight = kernel[(ky + radius) * kernelSize + (kx + radius)];
            sum += data[nidx * 4 + 3] * weight;
            weightSum += weight;
          }
        }
        newAlpha[idx] = Math.round(sum / weightSum);
      }
    }
  }
  
  for (let i = 0; i < width * height; i++) {
    data[i * 4 + 3] = newAlpha[i];
  }
  
  return imageData;
}

function sharpenEdgesPass(imageData: ImageData, strength: number, threshold: number): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  const isEdge = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;
      const alpha = data[pixelIdx + 3];
      
      if (alpha > 0 && alpha < 255) {
        let hasMoreTransparent = false;
        let hasMoreOpaque = false;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nidx = ((y + dy) * width + (x + dx)) * 4;
            const nalpha = data[nidx + 3];
            if (nalpha < alpha - 20) hasMoreTransparent = true;
            if (nalpha > alpha + 20) hasMoreOpaque = true;
          }
        }
        
        if (hasMoreTransparent && hasMoreOpaque) {
          isEdge[idx] = 1;
        }
      }
    }
  }
  
  const radius = 1;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (isEdge[idx] !== 1) continue;
      
      const pixelIdx = idx * 4;
      const origAlpha = data[pixelIdx + 3];
      
      let sum = 0;
      let count = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nidx = ((y + dy) * width + (x + dx)) * 4;
          sum += data[nidx + 3];
          count++;
        }
      }
      
      const blurredAlpha = sum / count;
      const diff = origAlpha - blurredAlpha;
      
      if (Math.abs(diff) > threshold) {
        const sharpened = origAlpha + diff * (strength / 100);
        data[pixelIdx + 3] = Math.max(0, Math.min(255, sharpened));
      }
    }
  }
  
  return imageData;
}

function gaussianKernel(radius: number): number[] {
  const size = radius * 2 + 1;
  const kernel = new Array(size * size);
  const sigma = radius / 2;
  let sum = 0;
  
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const value = Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      kernel[(y + radius) * size + (x + radius)] = value;
      sum += value;
    }
  }
  
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }
  
  return kernel;
}

export default EdgeLab;
