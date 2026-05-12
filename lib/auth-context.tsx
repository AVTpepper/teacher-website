"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();
// Request email + profile scopes (ensures displayName and photoURL are populated)
googleProvider.addScope("email");
googleProvider.addScope("profile");
// Always show account picker so users can switch accounts
googleProvider.setCustomParameters({ prompt: "select_account" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!auth);

  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      // Sync a thin session cookie for proxy-level route protection
      if (firebaseUser) {
        document.cookie = `__session=1; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;

        // Ensure displayNameLower is set so @mention search works for all accounts.
        // Fire-and-forget: only patches documents that are missing the field.
        if (db && firebaseUser.displayName) {
          const userRef = doc(db, "users", firebaseUser.uid);
          getDoc(userRef).then((snap) => {
            if (snap.exists() && !snap.data().displayNameLower) {
              updateDoc(userRef, {
                displayNameLower: firebaseUser.displayName!.toLowerCase(),
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      } else {
        document.cookie = "__session=; path=/; max-age=0";
      }
    });

    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    if (!auth) throw new Error("Firebase Auth is not initialized");
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }

  async function signUp(email: string, password: string) {
    if (!auth) throw new Error("Firebase Auth is not initialized");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  }

  async function signInWithGoogle() {
    if (!auth) throw new Error("Firebase Auth is not initialized");
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }

  async function signOut() {
    if (!auth) throw new Error("Firebase Auth is not initialized");
    await firebaseSignOut(auth);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
