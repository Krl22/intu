import { useContext } from 'react';
import { AuthContext } from './AuthContextObject';
import type { AuthState } from './authTypes';

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};