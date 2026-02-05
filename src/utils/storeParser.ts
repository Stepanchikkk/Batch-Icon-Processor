/**
 * Определяет тип входных данных
 */
export type InputType = 
  | { type: 'google-play'; packageName: string }
  | { type: 'rustore'; packageName: string }
  | { type: 'package-name'; packageName: string }
  | { type: 'url'; url: string }
  | { type: 'file' };

export function detectInputType(input: string): InputType {
  const trimmed = input.trim();
  
  // Google Play URL
  if (trimmed.includes('play.google.com')) {
    const match = trimmed.match(/id=([a-zA-Z0-9._]+)/);
    if (match) {
      return { type: 'google-play', packageName: match[1] };
    }
  }
  
  // RuStore URL
  if (trimmed.includes('rustore.ru')) {
    const match = trimmed.match(/\/app\/([a-zA-Z0-9._]+)/);
    if (match) {
      return { type: 'rustore', packageName: match[1] };
    }
  }
  
  // Прямая ссылка на изображение
  if (trimmed.match(/^https?:\/\/.+\.(png|jpg|jpeg|webp)/i)) {
    return { type: 'url', url: trimmed };
  }
  
  // Любой другой URL
  if (trimmed.match(/^https?:\/\//)) {
    return { type: 'url', url: trimmed };
  }
  
  // Package name (формат: com.example.app)
  if (trimmed.match(/^[a-zA-Z0-9._]+$/)) {
    return { type: 'package-name', packageName: trimmed };
  }
  
  return { type: 'file' };
}

/**
 * Парсит Google Play через CORS proxy (для демо)
 * В реальном приложении нужен backend
 */
export async function parseGooglePlay(packageName: string): Promise<{ iconUrl: string; appName: string } | null> {
  try {
    const url = `https://play.google.com/store/apps/details?id=${packageName}&hl=ru`;
    
    // Используем allorigins.win как CORS proxy для демонстрации
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error('Не удалось загрузить страницу');
    }
    
    const html = await response.text();
    
    // Парсим иконку
    let iconUrl: string | null = null;
    const iconMatch = html.match(/src="(https:\/\/play-lh\.googleusercontent\.com[^"]+)"/);
    if (iconMatch) {
      iconUrl = iconMatch[1].replace(/=w\d+-h\d+(-rw)?/, '=w512-h512');
    }
    
    // Парсим название
    let appName: string | null = null;
    const nameMatch = html.match(/itemprop="name"[^>]*>([^<]+)</);
    if (nameMatch) {
      appName = nameMatch[1].trim();
    }
    
    if (iconUrl && appName) {
      return { iconUrl, appName };
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка парсинга Google Play:', error);
    return null;
  }
}

/**
 * Парсит RuStore через CORS proxy
 */
export async function parseRuStore(packageName: string): Promise<{ iconUrl: string; appName: string } | null> {
  try {
    const url = `https://www.rustore.ru/catalog/app/${packageName}`;
    
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error('Не удалось загрузить страницу');
    }
    
    const html = await response.text();
    
    // Парсим иконку
    let iconUrl: string | null = null;
    const iconMatch = html.match(/data-testid="icon"[^>]+srcset="([^"]+)"/);
    if (iconMatch) {
      const srcset = iconMatch[1];
      const firstUrl = srcset.split(',')[0].trim().split(' ')[0];
      
      // Извлекаем оригинальный URL если есть /plain/
      if (firstUrl.includes('/plain/')) {
        const originalMatch = firstUrl.match(/\/plain\/(https[^@]+)/);
        if (originalMatch) {
          iconUrl = originalMatch[1];
        } else {
          iconUrl = firstUrl;
        }
      } else {
        iconUrl = firstUrl;
      }
    }
    
    // Парсим название
    let appName: string | null = null;
    const nameMatch = html.match(/data-testid="name"[^>]*>([^<]+)</);
    if (nameMatch) {
      appName = nameMatch[1].trim();
    }
    
    if (iconUrl && appName) {
      return { iconUrl, appName };
    }
    
    return null;
  } catch (error) {
    console.error('Ошибка парсинга RuStore:', error);
    return null;
  }
}

/**
 * Получает иконку из магазина (сначала Google Play, потом RuStore)
 */
export async function getIconFromStore(packageName: string): Promise<{ iconUrl: string; appName: string; source: string } | null> {
  // Пробуем Google Play
  const googleResult = await parseGooglePlay(packageName);
  if (googleResult) {
    return { ...googleResult, source: 'Google Play' };
  }
  
  // Fallback на RuStore
  const rustoreResult = await parseRuStore(packageName);
  if (rustoreResult) {
    return { ...rustoreResult, source: 'RuStore' };
  }
  
  return null;
}
