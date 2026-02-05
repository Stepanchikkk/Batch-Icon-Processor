import { useState, useCallback } from 'react';
import { BatchProcessor, ProcessedFile } from '@/components/BatchProcessor';
import { BackgroundOverlay, OverlayFile } from '@/components/BackgroundOverlay';

type Tab = 'remove' | 'overlay';

interface ProcessedIcon {
  file: File;
  preview: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>('remove');
  
  const [removeFiles, setRemoveFiles] = useState<ProcessedFile[]>([]);
  const [overlayFiles, setOverlayFiles] = useState<OverlayFile[]>([]);
  const [sentToOverlay, setSentToOverlay] = useState(false);

  const handleSendToOverlay = useCallback((icons: ProcessedIcon[]) => {
    const newFiles: OverlayFile[] = icons.map(icon => ({
      id: crypto.randomUUID(),
      original: icon.file,
      preview: icon.preview,
      status: 'pending' as const,
      result: null
    }));
    
    setOverlayFiles(prev => {
      const existingNames = new Set(prev.map(f => f.original.name));
      const filtered = newFiles.filter(f => !existingNames.has(f.original.name));
      return [...prev, ...filtered];
    });
    
    setSentToOverlay(true);
    setActiveTab('overlay');
  }, []);

  const doneCount = removeFiles.filter(f => f.status === 'done' && f.result).length;
  const hasUnsentIcons = doneCount > 0 && !sentToOverlay;

  const handleRequestIcons = useCallback(() => {
    const doneFiles = removeFiles.filter(f => f.status === 'done' && f.result);
    const icons: ProcessedIcon[] = doneFiles.map(f => {
      const arr = f.result!.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const file = new File([u8arr], f.original.name, { type: mime });
      
      return {
        file,
        preview: f.result!
      };
    });
    handleSendToOverlay(icons);
  }, [removeFiles, handleSendToOverlay]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="sticky top-0 z-40 bg-gray-950 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="flex gap-1 pt-4">
            <button
              onClick={() => setActiveTab('remove')}
              className={`px-5 py-3 text-sm font-medium rounded-t-lg transition ${
                activeTab === 'remove'
                  ? 'bg-gray-900 text-white border-t border-l border-r border-gray-800'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
              }`}
            >
              1. Удаление фона
            </button>
            <button
              onClick={() => setActiveTab('overlay')}
              className={`px-5 py-3 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
                activeTab === 'overlay'
                  ? 'bg-gray-900 text-white border-t border-l border-r border-gray-800'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-900/50'
              }`}
            >
              2. Наложение фона
              {overlayFiles.length > 0 && (
                <span className="px-2 py-0.5 text-xs bg-blue-600 rounded-full">
                  {overlayFiles.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className={activeTab === 'remove' ? '' : 'hidden'}>
            <BatchProcessor 
              files={removeFiles}
              setFiles={setRemoveFiles}
              onSendToOverlay={handleSendToOverlay}
              onFilesChanged={() => setSentToOverlay(false)}
            />
          </div>
          <div className={activeTab === 'overlay' ? '' : 'hidden'}>
            <BackgroundOverlay
              files={overlayFiles}
              setFiles={setOverlayFiles}
              hasUnsentIcons={hasUnsentIcons}
              unsentCount={doneCount}
              onRequestIcons={handleRequestIcons}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
