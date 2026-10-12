/**
 * Auth Context for Qayd (Strictly Firebase Auth + Google Provider)
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

const defaultSettings: UserSettings = {
  numberFormat: 'arabic',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Security check: ensure user is authenticated and has email
      if (user && user.email) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (userSnap.exists()) {
            setUserProfile(userSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'مستخدم قيد',
              photoURL: user.photoURL || '',
              createdAt: Date.now(),
              settings: defaultSettings,
            };
            await setDoc(userDocRef, newProfile);
            setUserProfile(newProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'مستخدم قيد',
            photoURL: user.photoURL || '',
            createdAt: Date.now(),
            settings: defaultSettings,
          });
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (!result.user) {
        throw new Error('فشل المصادقة مع Google');
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      throw new Error(error.message || 'فشل تسجيل الدخول باستخدام Google');
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
    } catch (error: any) {
      console.error('Logout Error:', error);
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
