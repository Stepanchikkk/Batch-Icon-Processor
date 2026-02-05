import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { removeBackground, createPreview } from '@/utils/backgroundRemoval';
import { Upload, Download, ImageIcon, Settings, Play, Trash2 } from './Icons';

interface ProcessedFile {
  original: File;
  processed?: Blob;
  preview?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export function BatchProcessor() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [referenceBackground, setReferenceBackground] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Drag & drop состояния
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [isDraggingBg, setIsDraggingBg] = useState(false);
  
  // Настройки
  const [threshold, setThreshold] = useState(20);
  const [edgeSmoothing, setEdgeSmoothing] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#1a1a1a');
  const [useColorMode, setUseColorMode] = useState(false);
  const [removeLightEdges, setRemoveLightEdges] = useState(false);
  const [erodePixels, setErodePixels] = useState(0);
  const [edgeCleanup, setEdgeCleanup] = useState(false);
  const [removeLiquidGlass, setRemoveLiquidGlass] = useState(false);
  const [glassWidth, setGlassWidth] = useState(2);
  const [glassBrightness, setGlassBrightness] = useState(220);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Пресеты настроек
  const applyPreset = (preset: 'soft' | 'normal' | 'aggressive' | 'liquidglass') => {
    if (preset === 'soft') {
      setThreshold(15);
      setEdgeSmoothing(false);
      setRemoveLightEdges(false);
      setErodePixels(0);
      setEdgeCleanup(false);
      setRemoveLiquidGlass(false);
    } else if (preset === 'normal') {
      setThreshold(25);
      setEdgeSmoothing(true);
      setRemoveLightEdges(true);
      setErodePixels(1);
      setEdgeCleanup(false);
      setRemoveLiquidGlass(false);
    } else if (preset === 'aggressive') {
      setThreshold(35);
      setEdgeSmoothing(true);
      setRemoveLightEdges(true);
      setErodePixels(2);
      setEdgeCleanup(true);
      setRemoveLiquidGlass(false);
    } else if (preset === 'liquidglass') {
      setThreshold(25);
      setEdgeSmoothing(true);
      setRemoveLightEdges(true);
      setErodePixels(1);
      setEdgeCleanup(false);
      setRemoveLiquidGlass(true);
      setGlassWidth(2);
      setGlassBrightness(220);
    }
  };

  // Добавление файлов с заменой дубликатов
  const addFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      const existingByName = new Map<string, number>();
      prev.forEach((f, idx) => existingByName.set(f.original.name, idx));
      
      const updated = [...prev];
      const toAdd: ProcessedFile[] = [];
      
      for (const file of newFiles) {
        if (!file.type.startsWith('image/')) continue;
        
        const existingIdx = existingByName.get(file.name);
        
        if (existingIdx !== undefined) {
          updated[existingIdx] = {
            original: file,
            status: 'pending',
            processed: undefined,
            preview: undefined,
          };
        } else {
          toAdd.push({
            original: file,
            status: 'pending',
          });
        }
      }
      
      return [...updated, ...toAdd];
    });
  }, []);

  // Обработка загрузки файлов
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  };

  // Drag & Drop для файлов
  const handleFilesDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(true);
  };

  const handleFilesDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);
  };

  const handleFilesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFiles(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  // Обработка эталонной подложки
  const handleBackgroundSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await setBackground(file);
    }
  };

  const setBackground = async (file: File) => {
    setReferenceBackground(file);
    const preview = await createPreview(file);
    setBgPreview(preview);
    setUseColorMode(false);
  };

  // Drag & Drop для эталона
  const handleBgDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(true);
  };

  const handleBgDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(false);
  };

  const handleBgDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingBg(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await setBackground(file);
    }
  };

  // Обработка одного файла
  const processFile = async (file: ProcessedFile, index: number): Promise<void> => {
    try {
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: 'processing' };
        return updated;
      });

      const processed = await removeBackground(
        file.original,
        useColorMode ? undefined : referenceBackground || undefined,
        {
          threshold,
          edgeSmoothing,
          targetBackgroundColor: useColorMode ? backgroundColor : undefined,
          removeLightEdges,
          erodePixels,
          edgeCleanup,
          removeLiquidGlass,
          glassOutlineWidth: glassWidth,
          glassBrightness,
        }
      );

      const preview = await createPreview(processed);

      setFiles(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          processed,
          preview,
          status: 'done',
        };
        return updated;
      });
    } catch (error) {
      setFiles(prev => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        return updated;
      });
    }
  };

  // Запуск пакетной обработки
  const startBatchProcessing = async () => {
    setIsProcessing(true);
    setCurrentIndex(0);

    const preventClose = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    
    window.addEventListener('beforeunload', preventClose);

    try {
      for (let i = 0; i < files.length; i++) {
        if (files[i].status === 'pending' || files[i].status === 'error') {
          setCurrentIndex(i + 1);
          await processFile(files[i], i);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } finally {
      window.removeEventListener('beforeunload', preventClose);
      setIsProcessing(false);
    }
  };

  // Конвертация Blob в base64 data URL
  const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Скачать все как ZIP
  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    
    let count = 0;
    for (const file of files) {
      if (file.processed) {
        const ext = file.original.name.split('.').pop() || 'png';
        const baseName = file.original.name.replace(/\.[^/.]+$/, '');
        zip.file(`${baseName}_no_bg.${ext}`, file.processed);
        count++;
      }
    }

    if (count === 0) {
      alert('Нет обработанных файлов для скачивания');
      return;
    }

    try {
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      // Используем data URL вместо blob URL для совместимости с iframe
      const dataUrl = await blobToDataURL(blob);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `processed_icons_${count}_files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка при создании ZIP:', error);
      alert('Ошибка при создании ZIP. Попробуйте скачать файлы по одному.');
    }
  };

  // Скачать промежуточные результаты
  const downloadProgress = async () => {
    if (processedCount === 0) {
      alert('Пока нет обработанных файлов');
      return;
    }

    if (confirm(`Скачать промежуточные результаты? (${processedCount} из ${files.length} файлов)`)) {
      await downloadAllAsZip();
    }
  };

  // Скачать один файл
  const downloadSingle = async (file: ProcessedFile) => {
    if (!file.processed) return;
    
    try {
      const dataUrl = await blobToDataURL(file.processed);
      const a = document.createElement('a');
      a.href = dataUrl;
      const ext = file.original.name.split('.').pop() || 'png';
      const baseName = file.original.name.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}_no_bg.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка при скачивании:', error);
      alert('Ошибка при скачивании файла');
    }
  };

  // Очистить всё
  const clearAll = () => {
    setFiles([]);
    setCurrentIndex(0);
  };

  const processedCount = files.filter(f => f.status === 'done').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🎨 Batch Icon Processor
          </h1>
          <p className="text-gray-400">
            Извлеките иконки из подложки • Drag & Drop поддерживается!
          </p>
        </div>

        {/* Настройки */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="text-blue-400" />
            <h2 className="text-xl font-semibold">Настройки</h2>
          </div>

          {/* Пресеты */}
          <div className="mb-6 p-4 bg-gradient-to-r from-green-900/30 to-blue-900/30 border-2 border-green-500/50 rounded-lg">
            <div className="text-sm font-semibold mb-3 text-green-300">
              🎯 Быстрые пресеты
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => applyPreset('soft')}
                className="px-3 py-2 bg-green-600/30 hover:bg-green-600/50 border-2 border-green-500/70 rounded-lg text-sm font-semibold transition"
              >
                🟢 Мягкий
              </button>
              <button
                onClick={() => applyPreset('normal')}
                className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 rounded-lg text-sm transition"
              >
                🔵 Нормальный
              </button>
              <button
                onClick={() => applyPreset('aggressive')}
                className="px-3 py-2 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/50 rounded-lg text-sm transition"
              >
                🟠 Агрессивный
              </button>
              <button
                onClick={() => applyPreset('liquidglass')}
                className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 rounded-lg text-sm transition"
              >
                ✨ Liquid Glass
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Эталонная подложка с Drag & Drop */}
            <div>
              <label className="block text-sm font-medium mb-2">
                🎯 Эталонная подложка
              </label>
              <input
                type="file"
                ref={bgInputRef}
                accept="image/*"
                onChange={handleBackgroundSelect}
                className="hidden"
              />
              <button
                onClick={() => bgInputRef.current?.click()}
                onDragOver={handleBgDragOver}
                onDragLeave={handleBgDragLeave}
                onDrop={handleBgDrop}
                className={`w-full px-4 py-4 rounded-lg transition flex items-center justify-center gap-2 border-2 border-dashed ${
                  isDraggingBg
                    ? 'bg-blue-600/50 border-blue-400 scale-105'
                    : referenceBackground 
                      ? 'bg-green-700 hover:bg-green-600 border-green-500' 
                      : 'bg-gray-700 hover:bg-gray-600 border-gray-500'
                }`}
              >
                <Upload size={20} />
                {isDraggingBg 
                  ? '📥 Отпустите файл!' 
                  : referenceBackground 
                    ? '✓ Подложка загружена' 
                    : 'Перетащите или выберите эталон'}
              </button>
              {bgPreview && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={bgPreview} alt="Background" className="w-16 h-16 rounded border border-gray-600" />
                  <div className="text-xs text-green-400">
                    ✓ Всё что видно на эталоне будет удалено
                  </div>
                </div>
              )}
            </div>

            {/* Порог */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Порог: {threshold}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Точнее</span>
                <span>Агрессивнее</span>
              </div>
            </div>

            {/* Режим по цвету */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Или удалить по цвету
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => {
                    setBackgroundColor(e.target.value);
                    setUseColorMode(true);
                    setReferenceBackground(null);
                    setBgPreview('');
                  }}
                  className="w-12 h-10 rounded cursor-pointer"
                />
                <div className="flex-1 px-3 py-2 bg-gray-700 rounded-lg text-sm">
                  {backgroundColor}
                </div>
              </div>
            </div>

            {/* Сглаживание */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="smoothing"
                checked={edgeSmoothing}
                onChange={(e) => setEdgeSmoothing(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="smoothing" className="text-sm">
                Сглаживание краёв
              </label>
            </div>
          </div>

          {/* Расширенные настройки */}
          <details className="mt-6">
            <summary className="cursor-pointer text-yellow-400 font-semibold">
              ⚡ Расширенные настройки (артефакты)
            </summary>
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="removeLightEdges"
                  checked={removeLightEdges}
                  onChange={(e) => setRemoveLightEdges(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="removeLightEdges" className="text-sm">
                  Удалять светлые края
                </label>
              </div>

              <div>
                <label className="block text-sm mb-1">
                  Эрозия: {erodePixels}px
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  value={erodePixels}
                  onChange={(e) => setErodePixels(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edgeCleanup"
                  checked={edgeCleanup}
                  onChange={(e) => setEdgeCleanup(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="edgeCleanup" className="text-sm">
                  Агрессивная очистка
                </label>
              </div>
            </div>
          </details>
        </div>

        {/* Предупреждение при обработке */}
        {isProcessing && (
          <div className="bg-yellow-600/20 border-2 border-yellow-500 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="text-2xl">⚠️</div>
            <div>
              <span className="font-bold text-yellow-400">НЕ ЗАКРЫВАЙТЕ СТРАНИЦУ!</span>
              <span className="text-gray-300 ml-2">Осталось: {files.length - currentIndex} файлов</span>
            </div>
          </div>
        )}

        {/* Загрузка файлов с Drag & Drop */}
        <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-4 md:p-6 mb-6">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            onChange={handleFilesSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleFilesDragOver}
            onDragLeave={handleFilesDragLeave}
            onDrop={handleFilesDrop}
            disabled={isProcessing}
            className={`w-full px-6 py-6 rounded-xl transition flex flex-col items-center justify-center gap-2 text-lg font-semibold border-2 border-dashed ${
              isDraggingFiles
                ? 'bg-purple-600/50 border-purple-400 scale-102'
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-transparent'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Upload size={32} />
            {isDraggingFiles 
              ? '📥 Отпустите файлы!' 
              : `Перетащите иконки сюда или нажмите для выбора`}
            <span className="text-sm font-normal opacity-75">
              {files.length > 0 ? `Загружено: ${files.length}` : 'Поддерживаются PNG, JPG, WebP'}
            </span>
          </button>

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={startBatchProcessing}
                disabled={isProcessing || pendingCount === 0}
                className="flex-1 min-w-[200px] px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <Play size={20} />
                {isProcessing ? `Обработка ${currentIndex}/${files.length}...` : `Запустить (${pendingCount})`}
              </button>
              
              <button
                onClick={isProcessing ? downloadProgress : downloadAllAsZip}
                disabled={processedCount === 0}
                className="flex-1 min-w-[200px] px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2 font-semibold"
              >
                <Download size={20} />
                {isProcessing ? `💾 Сохранить (${processedCount})` : `Скачать ZIP (${processedCount})`}
              </button>

              <button
                onClick={clearAll}
                disabled={isProcessing}
                className="px-4 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
              >
                <Trash2 size={20} />
              </button>
            </div>
          )}

          {/* Статистика */}
          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-sm">
              <div className="bg-gray-900/50 p-2 rounded-lg">
                <div className="text-xl font-bold">{files.length}</div>
                <div className="text-xs text-gray-400">Всего</div>
              </div>
              <div className="bg-blue-900/30 p-2 rounded-lg">
                <div className="text-xl font-bold text-blue-400">{pendingCount}</div>
                <div className="text-xs text-gray-400">Ожидают</div>
              </div>
              <div className="bg-green-900/30 p-2 rounded-lg">
                <div className="text-xl font-bold text-green-400">{processedCount}</div>
                <div className="text-xs text-gray-400">Готово</div>
              </div>
              <div className="bg-red-900/30 p-2 rounded-lg">
                <div className="text-xl font-bold text-red-400">{errorCount}</div>
                <div className="text-xs text-gray-400">Ошибки</div>
              </div>
            </div>
          )}
        </div>

        {/* Список файлов */}
        {files.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur border border-gray-700 rounded-2xl p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon className="text-purple-400" />
              <h2 className="text-xl font-semibold">Файлы ({files.length})</h2>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 max-h-[500px] overflow-y-auto">
              {files.map((file, index) => (
                <div
                  key={`${file.original.name}-${index}`}
                  className={`bg-gray-900/50 rounded-lg p-2 border-2 ${
                    file.status === 'done'
                      ? 'border-green-500'
                      : file.status === 'processing'
                      ? 'border-blue-500 animate-pulse'
                      : file.status === 'error'
                      ? 'border-red-500'
                      : 'border-gray-700'
                  }`}
                >
                  {file.preview ? (
                    <div className="relative group">
                      <img
                        src={file.preview}
                        alt={file.original.name}
                        className="w-full h-16 object-contain rounded bg-gray-800"
                      />
                      <button
                        onClick={() => downloadSingle(file)}
                        className="absolute top-0 right-0 bg-blue-600 hover:bg-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-full h-16 bg-gray-800 rounded flex items-center justify-center">
                      <ImageIcon className="text-gray-600" size={24} />
                    </div>
                  )}
                  
                  <div className="text-xs truncate mt-1" title={file.original.name}>
                    {file.original.name.replace(/\.[^/.]+$/, '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Инструкция */}
        {files.length === 0 && (
          <div className="bg-gray-800/30 border border-gray-700 rounded-2xl p-6 text-center">
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-xl font-bold mb-3">Как использовать?</h3>
            <div className="text-gray-400 space-y-1 text-sm">
              <p>1. Загрузите <strong className="text-white">эталонную подложку</strong> (drag & drop)</p>
              <p>2. Перетащите <strong className="text-white">все иконки</strong></p>
              <p>3. Нажмите <strong className="text-white">Запустить</strong></p>
              <p>4. <strong className="text-white">Скачайте ZIP</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
