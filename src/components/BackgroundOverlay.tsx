import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { Upload, Download, ImageIcon, Settings, Play, Trash2 } from './Icons';

export interface OverlayFile {
  id: string;
  original: File;
  preview: string;
  processed?: Blob;
  processedPreview?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
}

interface BackgroundOverlayProps {
  files: OverlayFile[];
  setFiles: React.Dispatch<React.SetStateAction<OverlayFile[]>>;
  hasUnsentIcons: boolean;
  unsentCount: number;
  onRequestIcons: () => void;
}

type SizeMode = 'icon-to-bg' | 'bg-to-icon' | 'custom';

export function BackgroundOverlay({ 
  files, 
  setFiles, 
  hasUnsentIcons, 
  unsentCount, 
  onRequestIcons 
}: BackgroundOverlayProps) {
  const [background, setBackground] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string>('');
  const [bgSize, setBgSize] = useState<{ width: number; height: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [modalFile, setModalFile] = useState<OverlayFile | null>(null);

  // Настройки размера
  const [sizeMode, setSizeMode] = useState<SizeMode>('custom');
  const [customSize, setCustomSize] = useState(235);
  const [iconScale, setIconScale] = useState(100);

  // Drag & drop
  const [isDraggingIcons, setIsDraggingIcons] = useState(false);
  const [isDraggingBg, setIsDraggingBg] = useState(false);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Добавить иконки вручную
  const addIconsManually = useCallback(async (newFiles: File[]) => {
    const toAdd: OverlayFile[] = [];

    for (const file of newFiles) {
      if (!file.type.startsWith('image/')) continue;
      const preview = await createPreview(file);
      toAdd.push({
        id: crypto.randomUUID(),
        original: file,
        preview,
        status: 'pending',
      });
    }

    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.original.name));
      const filtered = toAdd.filter(f => !existingNames.has(f.original.name));
      return [...prev, ...filtered];
    });
  }, [setFiles]);

  // Загрузить фон
  const loadBackground = async (file: File) => {
    setBackground(file);
    const preview = await createPreview(file);
    setBgPreview(preview);

    const img = new Image();
    img.onload = () => {
      setBgSize({ width: img.width, height: img.height });
    };
    img.src = preview;
  };

  // Обработка одной иконки
  const processIcon = async (icon: OverlayFile) => {
    if (!background) return;

    try {
      setFiles(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === icon.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], status: 'processing' };
        return updated;
      });

      const result = await overlayIconOnBackground(icon.original, background, {
        sizeMode,
        customSize,
        iconScale: iconScale / 100,
      });

      const preview = await createPreview(result);

      setFiles(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === icon.id);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            processed: result,
            processedPreview: preview,
            status: 'done',
          };
        }
        return updated;
      });
    } catch (error) {
      setFiles(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(f => f.id === icon.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], status: 'error' };
        return updated;
      });
    }
  };

  // Запуск обработки
  const startProcessing = async () => {
    if (!background || files.length === 0) return;

    setIsProcessing(true);
    setCurrentIndex(0);

    const preventClose = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', preventClose);

    try {
      const sorted = [...files].sort((a, b) => a.original.name.localeCompare(b.original.name));

      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].status === 'pending' || sorted[i].status === 'error') {
          setCurrentIndex(i + 1);
          await processIcon(sorted[i]);
          await new Promise(r => setTimeout(r, 30));
        }
      }
    } finally {
      window.removeEventListener('beforeunload', preventClose);
      setIsProcessing(false);
    }
  };

  // Скачать ZIP
  const downloadZip = async () => {
    const zip = new JSZip();
    let count = 0;

    for (const icon of files) {
      if (icon.processed) {
        const baseName = icon.original.name.replace(/\.[^/.]+$/, '');
        zip.file(`${baseName}.png`, icon.processed);
        count++;
      }
    }

    if (count === 0) return;

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = await blobToDataURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overlay_icons_${count}.zip`;
    a.click();
  };

  // Скачать один файл
  const downloadSingle = async (icon: OverlayFile) => {
    if (!icon.processed) return;
    const url = await blobToDataURL(icon.processed);
    const a = document.createElement('a');
    a.href = url;
    const baseName = icon.original.name.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}.png`;
    a.click();
  };

  const processedCount = files.filter(i => i.status === 'done').length;
  const pendingCount = files.filter(i => i.status === 'pending').length;

  const getOutputSize = (): string => {
    if (sizeMode === 'custom') return `${customSize}×${customSize}`;
    if (sizeMode === 'icon-to-bg' && bgSize) return `${bgSize.width}×${bgSize.height}`;
    if (sizeMode === 'bg-to-icon') return 'Размер иконки';
    return '—';
  };

  return (
    <div className="space-y-6">
      {/* Уведомление о доступных иконках из шага 1 */}
      {hasUnsentIcons && (
        <div className="bg-blue-500/10 border border-blue-500/50 rounded-lg p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-blue-400">
              Доступно {unsentCount} иконок из шага 1
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Нажмите чтобы добавить их для наложения фона
            </div>
          </div>
          <button
            onClick={onRequestIcons}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition"
          >
            Добавить
          </button>
        </div>
      )}

      {/* Настройки */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <Settings size={20} className="text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Настройки наложения</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Новый фон */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Новый фон</label>
            <input
              type="file"
              ref={bgInputRef}
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && loadBackground(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => bgInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDraggingBg(true); }}
              onDragLeave={() => setIsDraggingBg(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingBg(false);
                const file = e.dataTransfer.files[0];
                if (file?.type.startsWith('image/')) loadBackground(file);
              }}
              className={`w-full px-4 py-3 rounded transition flex items-center justify-center gap-2 border ${
                isDraggingBg
                  ? 'bg-blue-600/20 border-blue-500'
                  : background
                    ? 'bg-gray-800 border-green-600'
                    : 'bg-gray-800 hover:bg-gray-750 border-gray-700 hover:border-gray-600'
              }`}
            >
              <Upload size={18} />
              <span className="text-sm font-medium">
                {isDraggingBg ? '📥 Отпустите' : background ? 'Фон загружен' : 'Выберите или перетащите'}
              </span>
            </button>
            {bgPreview && (
              <div className="mt-3 flex items-center gap-3">
                <img src={bgPreview} alt="Background" className="w-12 h-12 rounded border border-gray-700" />
                <div className="text-xs text-gray-400">
                  {bgSize && `${bgSize.width}×${bgSize.height}`}
                </div>
              </div>
            )}
          </div>

          {/* Режим размера */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Размер результата</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sizeMode"
                  checked={sizeMode === 'icon-to-bg'}
                  onChange={() => setSizeMode('icon-to-bg')}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-300">Подогнать иконку под фон</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sizeMode"
                  checked={sizeMode === 'bg-to-icon'}
                  onChange={() => setSizeMode('bg-to-icon')}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-300">Подогнать фон под иконку</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="sizeMode"
                  checked={sizeMode === 'custom'}
                  onChange={() => setSizeMode('custom')}
                  className="accent-blue-600"
                />
                <span className="text-sm text-gray-300">Указать размер</span>
                {sizeMode === 'custom' && (
                  <input
                    type="number"
                    value={customSize}
                    onChange={(e) => setCustomSize(Number(e.target.value))}
                    className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm"
                    min={32}
                    max={1024}
                  />
                )}
              </label>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Итоговый размер: {getOutputSize()}
            </div>
          </div>

          {/* Масштаб иконки */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">
              Масштаб иконки ({iconScale}%)
            </label>
            <input
              type="range"
              min={30}
              max={150}
              value={iconScale}
              onChange={(e) => setIconScale(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>30%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Загрузка иконок */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <input
          type="file"
          ref={iconInputRef}
          multiple
          accept="image/*"
          onChange={(e) => addIconsManually(Array.from(e.target.files || []))}
          className="hidden"
        />

        <button
          onClick={() => iconInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingIcons(true); }}
          onDragLeave={() => setIsDraggingIcons(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingIcons(false);
            addIconsManually(Array.from(e.dataTransfer.files));
          }}
          disabled={isProcessing}
          className={`w-full px-6 py-8 rounded transition flex flex-col items-center justify-center gap-3 border-2 border-dashed ${
            isDraggingIcons
              ? 'bg-blue-500/10 border-blue-500'
              : 'bg-gray-800/50 hover:bg-gray-800 border-gray-700 hover:border-gray-600'
          } disabled:opacity-50`}
        >
          <Upload size={28} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-300">
            {isDraggingIcons
              ? 'Отпустите файлы'
              : files.length > 0
                ? `Загружено: ${files.length}`
                : 'Загрузите иконки без фона'}
          </span>
          <span className="text-xs text-gray-500">
            Или добавьте из первого шага
          </span>
        </button>

        {files.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={startProcessing}
              disabled={isProcessing || !background || pendingCount === 0}
              className="flex-1 min-w-[200px] px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Play size={16} />
              {isProcessing ? `${currentIndex}/${files.length}` : `Наложить (${pendingCount})`}
            </button>

            <button
              onClick={downloadZip}
              disabled={processedCount === 0}
              className="flex-1 min-w-[200px] px-5 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded transition flex items-center justify-center gap-2 font-medium text-sm"
            >
              <Download size={16} />
              ZIP ({processedCount})
            </button>

            <button
              onClick={() => setFiles([])}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded transition"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Статистика */}
        {files.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
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
          </div>
        )}
      </div>

      {/* Список иконок */}
      {files.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <ImageIcon size={18} className="text-gray-500" />
            <h2 className="text-lg font-semibold text-white">Иконки ({files.length})</h2>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 max-h-[500px] overflow-y-auto">
            {[...files].sort((a, b) => a.original.name.localeCompare(b.original.name)).map((icon) => (
              <div
                key={icon.id}
                onClick={() => setModalFile(icon)}
                className={`aspect-square bg-gray-800 rounded p-1.5 border cursor-pointer hover:opacity-80 transition ${
                  icon.status === 'done'
                    ? 'border-green-600'
                    : icon.status === 'processing'
                      ? 'border-blue-600 animate-pulse'
                      : icon.status === 'error'
                        ? 'border-red-600'
                        : 'border-gray-700'
                }`}
              >
                <div className="relative w-full h-full group">
                  <img
                    src={icon.processedPreview || icon.preview}
                    alt={icon.original.name}
                    className="w-full h-full object-contain rounded bg-gray-900"
                  />
                  {icon.processed && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSingle(icon);
                      }}
                      className="absolute top-0 right-0 bg-blue-600 hover:bg-blue-500 p-1 rounded opacity-0 group-hover:opacity-100 transition"
                    >
                      <Download size={10} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модалка */}
      {modalFile && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setModalFile(null)}
        >
          <div
            className="bg-gray-900 border border-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white truncate">{modalFile.original.name}</h3>
              <button
                onClick={() => setModalFile(null)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium mb-2 text-gray-400">Иконка</div>
                  <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                    <img src={modalFile.preview} alt="Original" className="max-w-full max-h-[400px] object-contain" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2 text-gray-400">
                    {modalFile.status === 'done' ? 'С новым фоном' : 'Ожидает'}
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-center min-h-[300px]">
                    {modalFile.processedPreview ? (
                      <img src={modalFile.processedPreview} alt="Processed" className="max-w-full max-h-[400px] object-contain" />
                    ) : (
                      <div className="text-gray-600">Не обработано</div>
                    )}
                  </div>
                </div>
              </div>

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
            <p>1. Загрузите новый фон</p>
            <p>2. Добавьте иконки без фона (из шага 1 или свои)</p>
            <p>3. Настройте размер и масштаб</p>
            <p>4. Запустите наложение</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Вспомогательные функции
async function createPreview(file: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface OverlayOptions {
  sizeMode: SizeMode;
  customSize: number;
  iconScale: number;
}

async function overlayIconOnBackground(
  iconFile: File,
  bgFile: File,
  options: OverlayOptions
): Promise<Blob> {
  const { sizeMode, customSize, iconScale } = options;

  const [iconImg, bgImg] = await Promise.all([
    loadImage(iconFile),
    loadImage(bgFile),
  ]);

  let outputSize: number;
  if (sizeMode === 'icon-to-bg') {
    outputSize = Math.max(bgImg.width, bgImg.height);
  } else if (sizeMode === 'bg-to-icon') {
    outputSize = Math.max(iconImg.width, iconImg.height);
  } else {
    outputSize = customSize;
  }

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(bgImg, 0, 0, outputSize, outputSize);

  const iconTargetSize = outputSize * iconScale;
  const iconRatio = iconImg.width / iconImg.height;

  let iconW: number, iconH: number;
  if (iconRatio > 1) {
    iconW = iconTargetSize;
    iconH = iconTargetSize / iconRatio;
  } else {
    iconH = iconTargetSize;
    iconW = iconTargetSize * iconRatio;
  }

  const offsetX = (outputSize - iconW) / 2;
  const offsetY = (outputSize - iconH) / 2;

  ctx.drawImage(iconImg, offsetX, offsetY, iconW, iconH);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
