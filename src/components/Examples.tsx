export function Examples() {
  const examples = [
    {
      title: 'Google Play',
      input: 'https://play.google.com/store/apps/details?id=com.vkontakte.android',
      description: 'Полная ссылка на приложение'
    },
    {
      title: 'RuStore',
      input: 'https://www.rustore.ru/catalog/app/com.telegram.messenger',
      description: 'Ссылка на RuStore'
    },
    {
      title: 'Package Name',
      input: 'com.whatsapp',
      description: 'Только имя пакета'
    },
    {
      title: 'Прямая ссылка',
      input: 'https://example.com/icon.png',
      description: 'URL изображения'
    }
  ];

  return (
    <div className="mb-6 rounded-2xl bg-white/5 p-6 backdrop-blur-lg">
      <h3 className="mb-4 text-lg font-semibold text-white">📚 Примеры</h3>
      
      <div className="grid gap-3 md:grid-cols-2">
        {examples.map((example, idx) => (
          <div
            key={idx}
            className="rounded-lg bg-white/5 p-3 transition hover:bg-white/10"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded bg-purple-500/30 px-2 py-0.5 text-xs font-semibold text-purple-200">
                {example.title}
              </span>
            </div>
            <code className="block overflow-x-auto text-xs text-purple-100">
              {example.input}
            </code>
            <p className="mt-1 text-xs text-purple-300">
              {example.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
