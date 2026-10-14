import React from 'react';
import { X, FileText, Download, ExternalLink } from 'lucide-react';

interface ReceiptModalProps {
  receiptUrl: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receiptUrl, onClose }) => {
  const isPdf = receiptUrl.includes('.pdf') || receiptUrl.toLowerCase().includes('application/pdf');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#17233D] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#315BEB]" />
            <span>معاينة الإيصال</span>
          </h3>
          <div className="flex items-center gap-2">
            <a 
              href={receiptUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 text-slate-500 hover:text-[#315BEB] rounded-xl hover:bg-slate-100 transition-colors"
              title="فتح في نافذة جديدة"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-auto bg-[#F7F9FC] flex items-center justify-center">
          {isPdf ? (
            <div className="w-full h-[400px] flex flex-col items-center justify-center gap-4 bg-white rounded-2xl shadow-xs border border-slate-100 p-8">
              <FileText className="w-14 h-14 text-[#315BEB]" />
              <p className="font-bold text-sm text-[#17233D]">مستند PDF</p>
              <a 
                href={receiptUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-[#315BEB] text-white rounded-2xl text-xs font-bold hover:bg-[#2548cb] transition-colors"
              >
                فتح المستند
              </a>
            </div>
          ) : (
            <div className="max-h-[68vh] overflow-auto rounded-2xl shadow-xs border border-slate-100 bg-white p-2">
              <img 
                src={receiptUrl} 
                alt="إيصال العملية" 
                className="max-w-full h-auto object-contain rounded-xl mx-auto" 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
