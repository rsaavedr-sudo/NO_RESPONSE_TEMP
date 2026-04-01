import React from 'react';
import { Download, CheckCircle } from 'lucide-react';

interface DownloadButtonProps {
  url: string;
  filename: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ url, filename }) => {
  return (
    <a
      href={url}
      download={filename}
      className="flex items-center justify-center gap-3 w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98]"
    >
      <Download className="w-6 h-6" />
      Descargar Resultados (CSV)
      <CheckCircle className="w-5 h-5" />
    </a>
  );
};
