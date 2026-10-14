/**
 * Auth Context for Qayd (Firebase Auth + Google Provider)
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, googleProvider, db, isConfigured } from '../services/firebase';
import { UserProfile, UserSettings } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<void>;
}

const defaultSettings: UserSettings = {
  numberFormat: 'english',
  timezone: 'Asia/Riyadh',
  weekStart: 'saturday',
};

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  isFirebaseConfigured: isConfigured,
  signInWithGoogle: async () => {},
  logout: async () => {},
  updateUserSettings: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Try loading cached profile for instant zero-delay rendering
    try {
      const cached = localStorage.getItem('qayd_cached_profile');
      if (cached) {
        setUserProfile(JSON.parse(cached));
      }
    } catch (e) {
      // Ignore storage errors
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Optimistic instant profile so the app loads immediately without any waiting screen
        const baseProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'مستخدم قَيد',
          photoURL: user.photoURL || '',
          createdAt: Date.now(),
          settings: defaultSettings,
        };

        setUserProfile(prev => {
          const next = prev ? { ...prev, uid: user.uid, email: user.email || prev.email, displayName: user.displayName || prev.displayName, photoURL: user.photoURL || prev.photoURL } : baseProfile;
          try {
            localStorage.setItem('qayd_cached_profile', JSON.stringify(next));
          } catch (e) {}
          return next;
        });

        // Unblock immediately!
        setLoading(false);

        // Fetch / sync firestore profile asynchronously in the background
        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef).then((userSnap) => {
          if (userSnap.exists()) {
            const data = userSnap.data();
            const syncedProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'مستخدم قَيد',
              photoURL: user.photoURL || '',
              createdAt: data.createdAt || Date.now(),
              settings: {
                ...defaultSettings,
                ...(data.settings || {}),
              },
            };
            setUserProfile(syncedProfile);
            try {
              localStorage.setItem('qayd_cached_profile', JSON.stringify(syncedProfile));
            } catch (e) {}
          } else {
            // First time user: save doc in background
            setDoc(userDocRef, baseProfile).catch((err) => {
              console.warn('Silent user profile creation error:', err);
            });
          }
        }).catch((err) => {
          console.warn('Silent user profile sync error:', err);
        });
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        try {
          localStorage.removeItem('qayd_cached_profile');
        } catch (e) {}
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        throw new Error('تم حظر النافذة المنبثقة من قبل المتصفح. يرجى السماح بالنوافذ المنبثقة لمتابعة تسجيل الدخول.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('تم إغلاق نافذة تسجيل الدخول قبل اكتمال العملية.');
      } else if (error.code === 'auth/cancelled-popup-request') {
        // Ignored
        return;
      }
      throw new Error(error.message || 'فشل تسجيل الدخول باستخدام Google.');
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error: any) {
      console.error('Logout error:', error);
      throw new Error('فشل تسجيل الخروج');
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!currentUser || !userProfile) return;
    const updatedSettings = { ...userProfile.settings, ...newSettings };
    const updatedProfile = { ...userProfile, settings: updatedSettings };
    
    try {
      const userDocRef = doc(db, 'users', currentUser.uid);
      await setDoc(userDocRef, { settings: updatedSettings }, { merge: true });
      setUserProfile(updatedProfile);
    } catch (error) {
      console.error('Error updating user settings:', error);
      throw new Error('فشل حفظ الإعدادات');
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      userProfile,
      loading,
      isFirebaseConfigured: isConfigured,
      signInWithGoogle,
      logout,
      updateUserSettings,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
