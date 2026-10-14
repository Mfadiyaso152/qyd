import React, { useState } from 'react';
import { 
  Globe, 
  Calendar, 
  Hash, 
  LogOut, 
  Coins, 
  UserCheck, 
  Check, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { UserSettings } from '../types';

export const Settings: React.FC = () => {
  const { userProfile, updateUserSettings, logout } = useAuth();
  const { success, error: notifyError } = useNotification();
  
  const [numberFormat, setNumberFormat] = useState<'arabic' | 'english'>(
    userProfile?.settings?.numberFormat || 'english'
  );
  const [timezone, setTimezone] = useState<string>(
    userProfile?.settings?.timezone || 'Asia/Riyadh'
  );
  const [weekStart, setWeekStart] = useState<'saturday' | 'sunday' | 'monday'>(
    userProfile?.settings?.weekStart || 'saturday'
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateUserSettings({
        numberFormat,
        timezone,
        weekStart,
      });
      success('تم حفظ التفضيلات بنجاح');
    } catch (err: any) {
      notifyError(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-[#17233D] tracking-tight">الإعدادات</h1>
      </div>

      {/* User Google Account Card matching Image 3 */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {userProfile?.photoURL ? (
            <img 
              src={userProfile.photoURL} 
              alt={userProfile.displayName} 
              className="w-14 h-14 rounded-full object-cover border border-slate-200" 
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#315BEB] text-white flex items-center justify-center font-bold text-xl">
              {userProfile?.displayName?.[0] || 'ق'}
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-[#17233D]">{userProfile?.displayName || 'المستخدم'}</h2>
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.95H1.14v3.15C3.15 21.36 7.23 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.6H1.14C.41 8.08 0 9.74 0 12s.41 3.92 1.14 5.4l4.14-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.23 0 3.15 2.64 1.14 6.6l4.14 3.15c.95-2.84 3.6-4.95 6.72-4.95z"/>
              </svg>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{userProfile?.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="px-4 py-2 rounded-2xl bg-[#F7F9FC] border border-slate-200 text-xs font-semibold text-slate-600 hover:text-[#315BEB] hover:border-blue-200 transition-all self-start sm:self-auto"
        >
          تغيير الحساب
        </button>
      </div>

      {/* Preferences Form matching Image 3 */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs space-y-6">
        {/* Timezone */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F7F9FC] text-[#315BEB] flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#17233D]">المنطقة الزمنية</label>
              <p className="text-[11px] text-slate-400">تحديد توقيت تسجيل العمليات وبداية اليوم</p>
            </div>
          </div>

          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full sm:w-56 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-[#17233D] bg-white focus:outline-none focus:border-[#315BEB]"
          >
            <option value="Asia/Riyadh">(الرياض) Asia/Riyadh</option>
            <option value="Asia/Dubai">(دبي) Asia/Dubai</option>
            <option value="Asia/Kuwait">(الكويت) Asia/Kuwait</option>
            <option value="Africa/Cairo">(القاهرة) Africa/Cairo</option>
            <option value="UTC">(توقيت غرينتش) UTC</option>
          </select>
        </div>

        {/* Week Start */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F7F9FC] text-[#315BEB] flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#17233D]">بداية الأسبوع</label>
              <p className="text-[11px] text-slate-400">اليوم الأول في التقويم والتقارير الأسبوعية</p>
            </div>
          </div>

          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value as any)}
            className="w-full sm:w-56 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-[#17233D] bg-white focus:outline-none focus:border-[#315BEB]"
          >
            <option value="saturday">السبت</option>
            <option value="sunday">الأحد</option>
            <option value="monday">الإثنين</option>
          </select>
        </div>

        {/* Number Format */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F7F9FC] text-[#315BEB] flex items-center justify-center">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#17233D]">تنسيق الأعداد</label>
              <p className="text-[11px] text-slate-400">شكل عرض الأرقام والمبالغ المالية</p>
            </div>
          </div>

          <select
            value={numberFormat}
            onChange={(e) => setNumberFormat(e.target.value as any)}
            className="w-full sm:w-56 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-semibold text-[#17233D] bg-white focus:outline-none focus:border-[#315BEB]"
          >
            <option value="english">(إنجليزي) 1,234.56</option>
            <option value="arabic">(عربي) ١٬٢٣٤٫٥٦</option>
          </select>
        </div>

        {/* Base Currency (Fixed to SAR) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F7F9FC] text-[#315BEB] flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#17233D]">العملة الأساسية</label>
              <p className="text-[11px] text-slate-400">الريال السعودي (SAR) هو العملة المعتمدة للمنصة</p>
            </div>
          </div>

          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            الريال السعودي (ر.س)
          </span>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-2xl bg-[#315BEB] hover:bg-[#2548cb] text-white font-semibold text-xs shadow-sm transition-all disabled:opacity-50 min-h-[40px]"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التفضيلات'}
          </button>
        </div>
      </form>

      {/* Logout Card matching Image 3 */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-[#17233D]">تسجيل الخروج</h3>
          <p className="text-xs text-slate-400 mt-0.5">إنهاء جلستك الحالية على هذا الجهاز</p>
        </div>

        <button
          onClick={() => logout()}
          className="px-5 py-2.5 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-semibold text-xs transition-colors flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};
