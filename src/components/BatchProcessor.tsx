import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { removeBackground, createPreview } from '@/utils/backgroundRemoval';
import { Upload, Download, ImageIcon, Settings, Play, Trash2 } from './Icons';

interface ProcessedFile {
  original: File;
  processed?: Blob;
  preview?: string;
  originalPreview?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export function BatchProcessor() {
  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [referenceBackground, setReferenceBackground] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalFile, setModalFile] = useState<ProcessedFile | null>(null);
  
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Пресеты настроек
  const applyPreset = (preset: 'soft' | 'normal' | 'aggressive') => {
    if (preset === 'soft') {
      setThreshold(15);
      setEdgeSmoothing(false);
      setRemoveLightEdges(false);
      setErodePixels(0);
      setEdgeCleanup(false);
    } else if (preset === 'normal') {
      setThreshold(25);
      setEdgeSmoothing(true);
      setRemoveLightEdges(true);
      setErodePixels(1);
      setEdgeCleanup(false);
    } else if (preset === 'aggressive') {
      setThreshold(35);
      setEdgeSmoothing(true);
      setRemoveLightEdges(true);
      setErodePixels(2);
      setEdgeCleanup(true);
    }
  };

  // Добавление файлов с заменой дубликатов
  const addFiles = useCallback(async (newFiles: File[]) => {
    const filesToAdd: ProcessedFile[] = [];
    
    // Создаём превью для всех новых файлов
    for (const file of newFiles) {
      if (!file.type.startsWith('image/')) continue;
      
      const originalPreview = await createPreview(file);
      filesToAdd.push({
        original: file,
        originalPreview,
        status: 'pending',
      });
    }
    
    setFiles(prev => {
      const existingByName = new Map<string, number>();
      prev.forEach((f, idx) => existingByName.set(f.original.name, idx));
      
      const updated = [...prev];
      const toAdd: ProcessedFile[] = [];
      
      for (const file of filesToAdd) {
        const existingIdx = existingByName.get(file.original.name);
        
        if (existingIdx !== undefined) {
          updated[existingIdx] = file;
        } else {
          toAdd.push(file);
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
      // Обрабатываем в алфавитном порядке (как отображаем)
      const sortedFiles = [...files].sort((a, b) => 
        a.original.name.localeCompare(b.original.name)
      );

      for (let i = 0; i < sortedFiles.length; i++) {
        if (sortedFiles[i].status === 'pending' || sortedFiles[i].status === 'error') {
          setCurrentIndex(i + 1);
          
          // Находим индекс в оригинальном массиве
          const originalIndex = files.findIndex(f => f.original.name === sortedFiles[i].original.name);
          
          await processFile(files[originalIndex], originalIndex);
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
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Заголовок */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-1 text-white">
            Batch Icon Processor
          </h1>
          <p className="text-gray-500 text-sm">
            Массовое удаление подложки с иконок
          </p>
        </div>

        {/* Настройки */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <Settings size={20} className="text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Настройки обработки</h2>
          </div>

          {/* Пресеты */}
          <div className="mb-6">
            <div className="text-sm font-medium mb-3 text-gray-400">
              Пресеты
            </div>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => applyPreset('soft')}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded text-sm font-medium transition-all"
              >
                Мягкий
              </button>
              <button
                onClick={() => applyPreset('normal')}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded text-sm font-medium transition-all"
              >
                Нормальный
              </button>
              <button
                onClick={() => applyPreset('aggressive')}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500 rounded text-sm font-medium transition-all"
              >
                Агрессивный
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Эталонная подложка с Drag & Drop */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                Эталонная подложка
                <span className="text-xs text-gray-500 font-normal" title="Чистая подложка без иконки. Всё что видно на эталоне будет удалено с иконок.">
                  ℹ️
                </span>
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
                className={`w-full px-4 py-3 rounded transition flex items-center justify-center gap-2 border ${
                  isDraggingBg
                    ? 'bg-blue-600/20 border-blue-500'
                    : referenceBackground 
                      ? 'bg-gray-800 hover:bg-gray-750 border-green-600' 
                      : 'bg-gray-800 hover:bg-gray-750 border-gray-700 hover:border-gray-600'
                }`}
              >
                <Upload size={18} />
                <span className="text-sm font-medium">
                  {isDraggingBg 
                    ? '📥 Отпустите' 
                    : referenceBackground 
                      ? 'Эталон загружен' 
                      : 'Выберите или перетащите'}
                </span>
              </button>
              {bgPreview && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={bgPreview} alt="Background" className="w-12 h-12 rounded border border-gray-700" />
                  <div className="text-xs text-gray-400">
                    {referenceBackground?.name}
                  </div>
                </div>
              )}
            </div>

            {/* Порог */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300 flex items-center gap-2">
                Порог ({threshold})
                <span className="text-xs text-gray-500 font-normal" title="Насколько похож пиксель на эталон чтобы удалиться. Больше = удаляет больше похожих.">
                  ℹ️
                </span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Мягко</span>
                <span>Агрессивно</span>
              </div>
            </div>

            {/* Режим по цвету */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Удаление по цвету
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
                  className="w-10 h-10 rounded cursor-pointer bg-gray-800 border border-gray-700"
                />
                <div className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-400">
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
                className="w-4 h-4 accent-blue-600"
              />
              <label htmlFor="smoothing" className="text-sm text-gray-300 flex items-center gap-2">
                Сглаживание краёв
                <span className="text-xs text-gray-500 font-normal" title="Добавляет плавный переход вокруг иконки, убирает 'лесенку' на краях.">
                  ℹ️
                </span>
              </label>
            </div>
          </div>

          {/* Расширенные настройки */}
          <details className="mt-6 pt-6 border-t border-gray-800">
            <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-300">
              Дополнительные настройки
            </summary>
            <div className="mt-4 grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="removeLightEdges"
                  checked={removeLightEdges}
                  onChange={(e) => setRemoveLightEdges(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="removeLightEdges" className="text-sm text-gray-300 flex items-center gap-2">
                  Удалить светлые края
                  <span className="text-xs text-gray-500 font-normal" title="Удаляет светлые полупрозрачные пиксели на границе иконки.">
                    ℹ️
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm mb-1 text-gray-300 flex items-center gap-2">
                  Эрозия ({erodePixels}px)
                  <span className="text-xs text-gray-500 font-normal" title="Удаляет N пикселей от внешнего края иконки. Осторожно с мелкими деталями!">
                    ℹ️
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="3"
                  value={erodePixels}
                  onChange={(e) => setErodePixels(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="edgeCleanup"
                  checked={edgeCleanup}
                  onChange={(e) => setEdgeCleanup(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                <label htmlFor="edgeCleanup" className="text-sm text-gray-300 flex items-center gap-2">
                  Агрессивная очистка
                  <span className="text-xs text-gray-500 font-normal" title="Многократная обработка краёв для максимального удаления артефактов. Может повредить детали.">
                    ℹ️
                  </span>
                </label>
              </div>
            </div>
          </details>
        </div>

        {/* Предупреждение при обработке */}
        {isProcessing && (
          <div className="bg-amber-500/10 border border-amber-500/50 rounded p-4 mb-6 flex items-center gap-3">
            <div className="text-amber-500 font-semibold text-sm">
              Обработка...
            </div>
            <div className="flex-1 text-sm text-gray-400">
              Осталось: {files.length - currentIndex} из {files.length}
            </div>
            <div className="text-xs text-gray-500">
              Не закрывайте страницу
            </div>
          </div>
        )}

        {/* Загрузка файлов с Drag & Drop */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
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
            className={`w-full px-6 py-8 rounded transition flex flex-col items-center justify-center gap-3 border-2 border-dashed ${
              isDraggingFiles
                ? 'bg-blue-500/10 border-blue-500'
                : 'bg-gray-800/50 hover:bg-gray-800 border-gray-700 hover:border-gray-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Upload size={28} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-300">
              {isDraggingFiles 
                ? 'Отпустите файлы' 
                : files.length > 0 
                  ? `Загружено: ${files.length}` 
                  : 'Выберите файлы или перетащите сюда'}
            </span>
            {!isDraggingFiles && files.length === 0 && (
              <span className="text-xs text-gray-500">
                PNG, JPG, WebP
              </span>
            )}
          </button>

          {files.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={startBatchProcessing}
                disabled={isProcessing || pendingCount === 0}
                className="flex-1 min-w-[200px] px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Play size={16} />
                {isProcessing ? `${currentIndex}/${files.length}` : `Запустить (${pendingCount})`}
              </button>
              
              <button
                onClick={isProcessing ? downloadProgress : downloadAllAsZip}
                disabled={processedCount === 0}
                className="flex-1 min-w-[200px] px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition flex items-center justify-center gap-2 font-medium text-sm"
              >
                <Download size={16} />
                {isProcessing ? `Сохранить (${processedCount})` : `ZIP (${processedCount})`}
              </button>

              <button
                onClick={clearAll}
                disabled={isProcessing}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {/* Статистика */}
          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-lg font-semibold text-white">{files.length}</div>
                <div className="text-xs text-gray-500">Всего</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-lg font-semibold text-gray-400">{pendingCount}</div>
                <div className="text-xs text-gray-500">Ожидают</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-lg font-semibold text-green-500">{processedCount}</div>
                <div className="text-xs text-gray-500">Готово</div>
              </div>
              <div className="bg-gray-800 p-3 rounded">
                <div className="text-lg font-semibold text-red-500">{errorCount}</div>
                <div className="text-xs text-gray-500">Ошибки</div>
              </div>
            </div>
          )}
        </div>

        {/* Список файлов */}
        {files.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon size={18} className="text-gray-500" />
              <h2 className="text-lg font-semibold text-white">Файлы ({files.length})</h2>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 max-h-[500px] overflow-y-auto">
              {[...files].sort((a, b) => a.original.name.localeCompare(b.original.name)).map((file, index) => (
                <div
                  key={`${file.original.name}-${index}`}
                  className={`bg-gray-800 rounded p-2 border ${
                    file.status === 'done'
                      ? 'border-green-600'
                      : file.status === 'processing'
                      ? 'border-blue-600 animate-pulse'
                      : file.status === 'error'
                      ? 'border-red-600'
                      : 'border-gray-700'
                  }`}
                >
                  <div className="relative group">
                    <img
                      src={file.preview || file.originalPreview}
                      alt={file.original.name}
                      onClick={() => setModalFile(file)}
                      className="w-full h-16 object-contain rounded bg-gray-900 cursor-pointer hover:opacity-80 transition"
                    />
                    {file.processed && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadSingle(file);
                        }}
                        className="absolute top-0 right-0 bg-blue-600 hover:bg-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <Download size={10} />
                      </button>
                    )}
                  </div>
                  
                  <div className="text-xs truncate mt-1.5 text-gray-400" title={file.original.name}>
                    {file.original.name.replace(/\.[^/.]+$/, '')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Модалка просмотра */}
        {modalFile && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setModalFile(null)}
          >
            <div 
              className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Заголовок */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800">
                <h3 className="text-lg font-semibold text-white truncate">
                  {modalFile.original.name}
                </h3>
                <button
                  onClick={() => setModalFile(null)}
                  className="text-gray-400 hover:text-white text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              {/* Превью */}
              <div className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Оригинал */}
                  <div>
                    <div className="text-sm font-medium mb-2 text-gray-400">Оригинал</div>
                    <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                      {modalFile.originalPreview ? (
                        <img 
                          src={modalFile.originalPreview} 
                          alt="Original" 
                          className="max-w-full max-h-[400px] object-contain"
                        />
                      ) : (
                        <div className="text-gray-600">Загрузка...</div>
                      )}
                    </div>
                  </div>

                  {/* Обработанный */}
                  <div>
                    <div className="text-sm font-medium mb-2 text-gray-400">
                      {modalFile.status === 'done' ? 'Результат' : modalFile.status === 'processing' ? 'Обработка...' : 'Не обработан'}
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                      {modalFile.preview ? (
                        <img 
                          src={modalFile.preview} 
                          alt="Processed" 
                          className="max-w-full max-h-[400px] object-contain"
                        />
                      ) : modalFile.status === 'processing' ? (
                        <div className="text-blue-500 animate-pulse">Обработка...</div>
                      ) : (
                        <div className="text-gray-600">Ожидает обработки</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Действия */}
                {modalFile.processed && (
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => downloadSingle(modalFile)}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded transition flex items-center justify-center gap-2 font-medium text-sm"
                    >
                      <Download size={16} />
                      Скачать
                    </button>
                    <button
                      onClick={() => setModalFile(null)}
                      className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded transition text-sm"
                    >
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Инструкция */}
        {files.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
            <div className="text-gray-500 space-y-2 text-sm">
              <p>1. Загрузите эталонную подложку</p>
              <p>2. Добавьте файлы для обработки</p>
              <p>3. Запустите обработку</p>
              <p>4. Скачайте результаты в ZIP</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
