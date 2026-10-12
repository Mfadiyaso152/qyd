/**
 * Receipt Viewer Modal Component
 */
import React from 'react';
import { X, FileText, Download } from 'lucide-react';

interface ReceiptModalProps {
  receiptUrl: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receiptUrl, onClose }) => {
  const isPdf = receiptUrl.includes('.pdf') || receiptUrl.toLowerCase().includes('application/pdf');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-[#142B36] text-white flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#B9E6CF]" />
            معاينة الإيصال المرفق
          </h3>
          <div className="flex items-center gap-2">
            <a 
              href={receiptUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              title="فتح في نافذة جديدة"
            >
              <Download className="w-4 h-4" />
            </a>
            <button 
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-rose-500/80 rounded-lg transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-auto bg-[#F7F4EB] flex items-center justify-center">
          {isPdf ? (
            <div className="w-full h-[500px] flex flex-col items-center justify-center gap-4 bg-white rounded-xl shadow border border-slate-200 p-8">
              <FileText className="w-16 h-16 text-[#367C73]" />
              <p className="font-semibold text-slate-700">ملف مستند PDF</p>
              <a 
                href={receiptUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-6 py-2.5 bg-[#367C73] text-white rounded-xl font-medium hover:bg-[#2b635b] transition-colors"
              >
                فتح المستند في نافذة جديدة
              </a>
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-xl shadow border border-slate-200 bg-white p-2">
              <img 
                src={receiptUrl} 
                alt="إيصال العملية" 
                className="max-w-full h-auto object-contain rounded-lg mx-auto" 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
