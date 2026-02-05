import { useState } from 'react';
import { detectInputType, getIconFromStore } from '@/utils/storeParser';
import { removeBg, overlayOnBackground, downloadImage, blobToImage, downloadBlob } from '@/utils/imageProcessor';
import { Examples } from './Examples';

interface ProcessResult {
  packageName: string;
  appName?: string;
  source?: string;
  previewUrl: string;
  blob: Blob;
}

export function IconProcessor() {
  const [input, setInput] = useState('');
  const [packageNameInput, setPackageNameInput] = useState('');
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState('');
  const [needsPackageName, setNeedsPackageName] = useState(false);
  const [iconScale, setIconScale] = useState(0.8);

  // Загрузка подложки
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = await blobToImage(file);
      setBackgroundImage(img);
      setError('');
    } catch (err) {
      setError('Не удалось загрузить подложку');
    }
  };

  // Обработка входных данных
  const handleProcess = async () => {
    if (!input.trim()) {
      setError('Введите URL, package name или загрузите файл');
      return;
    }

    if (!backgroundImage) {
      setError('Сначала загрузите подложку (background.png)');
      return;
    }

    setProcessing(true);
    setError('');
    setResult(null);
    setProgress('Определяю тип ввода...');

    try {
      const inputType = detectInputType(input);
      let imageBlob: Blob;
      let packageName = '';
      let appName: string | undefined;
      let source: string | undefined;

      // Получаем изображение в зависимости от типа
      if (inputType.type === 'google-play' || inputType.type === 'rustore' || inputType.type === 'package-name') {
        packageName = inputType.packageName;
        setProgress(`📦 Package: ${packageName}`);
        
        setProgress('🔍 Ищу в магазинах приложений...');
        const storeData = await getIconFromStore(packageName);
        
        if (!storeData) {
          throw new Error('Не удалось найти приложение в Google Play или RuStore');
        }
        
        appName = storeData.appName;
        source = storeData.source;
        setProgress(`✓ Найдено в ${source}: ${appName}`);
        
        setProgress('⬇️  Скачиваю иконку...');
        imageBlob = await downloadImage(storeData.iconUrl);
      } else if (inputType.type === 'url') {
        setProgress('⬇️  Скачиваю изображение...');
        imageBlob = await downloadImage(inputType.url);
        
        // Запрашиваем package name
        if (!packageNameInput.trim()) {
          setNeedsPackageName(true);
          setProcessing(false);
          return;
        }
        packageName = packageNameInput.trim();
      } else {
        throw new Error('Неподдерживаемый формат ввода');
      }

      // Удаляем фон
      setProgress('🔄 Удаляю фон...');
      const noBgBlob = await removeBg(imageBlob);
      
      // Накладываем на подложку
      setProgress('🎨 Накладываю на подложку...');
      const finalBlob = await overlayOnBackground(noBgBlob, backgroundImage, iconScale);
      
      // Сохраняем результат
      const previewUrl = URL.createObjectURL(finalBlob);
      setResult({
        packageName,
        appName,
        source,
        previewUrl,
        blob: finalBlob
      });
      
      setProgress('✅ Готово!');
      setNeedsPackageName(false);
      setPackageNameInput('');
      
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при обработке');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  };

  // Скачивание результата
  const handleDownload = () => {
    if (!result) return;
    downloadBlob(result.blob, `${result.packageName}.png`);
  };

  // Обработка файла
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !backgroundImage) {
      if (!backgroundImage) {
        setError('Сначала загрузите подложку');
      }
      return;
    }

    setProcessing(true);
    setError('');
    setResult(null);
    setProgress('Обрабатываю файл...');

    try {
      // Запрашиваем package name
      const packageName = prompt('Введите package name для этого файла:');
      if (!packageName) {
        throw new Error('Package name не указан');
      }

      setProgress('🔄 Удаляю фон...');
      const noBgBlob = await removeBg(file);
      
      setProgress('🎨 Накладываю на подложку...');
      const finalBlob = await overlayOnBackground(noBgBlob, backgroundImage, iconScale);
      
      const previewUrl = URL.createObjectURL(finalBlob);
      setResult({
        packageName: packageName.trim(),
        previewUrl,
        blob: finalBlob
      });
      
      setProgress('✅ Готово!');
      
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка при обработке');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Заголовок */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-white">
            🎨 Icon Processor
          </h1>
          <p className="text-purple-200">
            Обработка иконок для темы HyperOS
          </p>
        </div>

        {/* Карточка загрузки подложки */}
        <div className="mb-6 rounded-2xl bg-white/10 p-6 backdrop-blur-lg">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              1. Загрузите подложку
            </h2>
            {backgroundImage && (
              <span className="text-green-400">✓ Загружено (235×235)</span>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            <label className="flex-1 cursor-pointer">
              <div className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-white transition hover:bg-purple-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span>Выбрать background.png</span>
              </div>
              <input
                type="file"
                accept="image/png"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
            </label>
            
            {backgroundImage && (
              <img
                src={backgroundImage.src}
                alt="Background"
                className="h-16 w-16 rounded-lg border-2 border-white/20"
              />
            )}
          </div>
          
          <p className="mt-2 text-sm text-purple-200">
            Размер: 235×235 пикселей. Иконки будут накладываться по центру.
          </p>
        </div>

        {/* Настройки */}
        <div className="mb-6 rounded-2xl bg-white/10 p-6 backdrop-blur-lg">
          <h2 className="mb-4 text-xl font-semibold text-white">
            2. Настройки
          </h2>
          
          <div>
            <label className="mb-2 block text-sm text-purple-200">
              Масштаб иконки: {iconScale.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={iconScale}
              onChange={(e) => setIconScale(parseFloat(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-purple-300">
              Размер иконки относительно подложки (0.5 = 50%, 1.0 = 100%)
            </p>
          </div>
        </div>

        {/* Основная форма */}
        <div className="mb-6 rounded-2xl bg-white/10 p-6 backdrop-blur-lg">
          <h2 className="mb-4 text-xl font-semibold text-white">
            3. Введите источник иконки
          </h2>
          
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Google Play URL, RuStore URL, package name, или прямая ссылка..."
                className="w-full rounded-lg bg-white/20 px-4 py-3 text-white placeholder-purple-300 outline-none ring-2 ring-purple-500/50 focus:ring-purple-400"
                disabled={processing}
              />
              
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-purple-200 md:grid-cols-2">
                <div>✓ https://play.google.com/store/apps/details?id=...</div>
                <div>✓ https://www.rustore.ru/catalog/app/...</div>
                <div>✓ com.vkontakte.android</div>
                <div>✓ https://example.com/icon.png</div>
              </div>
            </div>

            {needsPackageName && (
              <div>
                <label className="mb-2 block text-sm text-purple-200">
                  Введите package name для сохранения:
                </label>
                <input
                  type="text"
                  value={packageNameInput}
                  onChange={(e) => setPackageNameInput(e.target.value)}
                  placeholder="com.example.app"
                  className="w-full rounded-lg bg-white/20 px-4 py-3 text-white placeholder-purple-300 outline-none ring-2 ring-purple-500/50 focus:ring-purple-400"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleProcess}
                disabled={processing || !backgroundImage}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
              >
                {processing ? '⏳ Обработка...' : '🚀 Обработать'}
              </button>

              <label className="cursor-pointer">
                <div className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700">
                  📁 Файл
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={handleFileUpload}
                  disabled={processing || !backgroundImage}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Прогресс */}
        {progress && (
          <div className="mb-6 rounded-2xl bg-blue-500/20 p-4 backdrop-blur-lg">
            <p className="text-center text-white">{progress}</p>
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="mb-6 rounded-2xl bg-red-500/20 p-4 backdrop-blur-lg">
            <p className="text-center text-red-200">❌ {error}</p>
          </div>
        )}

        {/* Результат */}
        {result && (
          <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-lg">
            <h2 className="mb-4 text-xl font-semibold text-white">
              ✅ Результат
            </h2>
            
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4 md:flex-row">
                <img
                  src={result.previewUrl}
                  alt="Result"
                  className="h-48 w-48 rounded-2xl border-4 border-white/20 shadow-2xl"
                />
                
                <div className="flex-1 space-y-2 text-purple-100">
                  <p>
                    <strong className="text-white">Package:</strong> {result.packageName}
                  </p>
                  {result.appName && (
                    <p>
                      <strong className="text-white">Название:</strong> {result.appName}
                    </p>
                  )}
                  {result.source && (
                    <p>
                      <strong className="text-white">Источник:</strong> {result.source}
                    </p>
                  )}
                  <p>
                    <strong className="text-white">Файл:</strong> {result.packageName}.png
                  </p>
                </div>
              </div>

              <button
                onClick={handleDownload}
                className="w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white transition hover:from-green-700 hover:to-emerald-700"
              >
                💾 Скачать {result.packageName}.png
              </button>
            </div>
          </div>
        )}

        {/* Примеры */}
        <Examples />

        {/* Информация */}
        <div className="mt-8 rounded-2xl bg-white/5 p-6 backdrop-blur-lg">
          <h3 className="mb-3 text-lg font-semibold text-white">ℹ️ Как использовать</h3>
          <ul className="space-y-2 text-sm text-purple-200">
            <li>1. Загрузите подложку (background.png, 235×235px)</li>
            <li>2. Введите ссылку на приложение, package name или загрузите файл</li>
            <li>3. Дождитесь обработки</li>
            <li>4. Скачайте готовую иконку</li>
          </ul>
          
          <div className="mt-4 space-y-2 border-t border-purple-500/30 pt-4">
            <p className="text-xs text-purple-300">
              <strong>⚡ Удаление фона:</strong> Приложение автоматически удаляет светлый фон.
              Для лучших результатов используйте изображения с уже удаленным фоном (PNG с прозрачностью).
            </p>
            <p className="text-xs text-purple-300">
              <strong>🌐 Парсинг:</strong> Магазины приложений парсятся через CORS proxy.
              Если парсинг не работает, используйте прямую ссылку на изображение.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
