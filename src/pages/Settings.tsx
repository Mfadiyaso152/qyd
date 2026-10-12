/**
 * Settings Page Component
 */
import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Hash, 
  LogOut, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Settings: React.FC = () => {
  const { userProfile, updateUserSettings, logout } = useAuth();
  
  const [numberFormat, setNumberFormat] = useState<'arabic' | 'english'>(userProfile?.settings.numberFormat || 'arabic');
  
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setError('');

    try {
      await updateUserSettings({
        numberFormat,
      });
      setSuccessMessage('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 lg:pb-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold text-[#142B36] mb-1">الإعدادات</h2>
        <p className="text-sm text-slate-500">تخصيص تفضيلات الحساب وعرض الأرقام.</p>
      </div>

      {/* User Google Profile Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
        {userProfile?.photoURL ? (
          <img 
            src={userProfile.photoURL} 
            alt={userProfile.displayName} 
            className="w-16 h-16 rounded-full object-cover border-2 border-[#367C73]" 
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-[#367C73] text-white flex items-center justify-center text-2xl font-bold">
            {userProfile?.displayName?.[0] || 'ق'}
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold text-slate-800">{userProfile?.displayName}</h3>
          <p className="text-sm text-slate-500">{userProfile?.email}</p>
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
            <Check className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Number Format */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Hash className="w-4 h-4 text-[#367C73]" />
            <span>طريقة عرض الأرقام المالية</span>
          </label>
          <select
            value={numberFormat}
            onChange={(e) => setNumberFormat(e.target.value as any)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm focus:ring-2 focus:ring-[#367C73]"
          >
            <option value="arabic">الأرقام العربية (٠١٢٣٤٥٦٧٨٩)</option>
            <option value="english">الأرقام الإنجليزية (0123456789)</option>
          </select>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => logout()}
            className="px-5 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-sm transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-[#367C73] text-white font-semibold text-sm hover:bg-[#2b635b] transition-colors shadow-md disabled:opacity-50"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>
    </div>
  );
};
