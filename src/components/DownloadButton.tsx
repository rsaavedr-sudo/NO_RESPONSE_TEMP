import React from 'react';
import { Download, CheckCircle } from 'lucide-react';

interface DownloadButtonProps {
  url: string;
  filename: string;
  variant?: 'primary' | 'secondary';
  label?: string;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({ url, filename, variant = 'primary', label }) => {
  const baseStyles = "flex items-center justify-center gap-3 w-full py-4 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform active:scale-[0.98]";
  const variants = {
    primary: "bg-green-600 hover:bg-green-700 text-white",
    secondary: "bg-indigo-600 hover:bg-indigo-700 text-white"
  };

  const defaultLabel = variant === 'primary' ? 'Descargar Resultados (CSV)' : 'Descargar Detalle CDR (CSV)';

  return (
    <a
      href={url}
      download={filename}
      className={`${baseStyles} ${variants[variant]}`}
    >
      <Download className="w-6 h-6" />
      {label || defaultLabel}
      <CheckCircle className="w-5 h-5" />
    </a>
  );
};
