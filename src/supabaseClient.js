// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

// Configuration Supabase avec les vraies valeurs
const supabaseUrl = 'https://ntflmnnwoamugjkciryt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50Zmxtbm53b2FtdWdqa2Npcnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2NTc2NjgsImV4cCI6MjA2ODIzMzY2OH0.mHKZQ0wLAKn2r7AhkJBDH6E0DZYgte_DY9jT35evNOw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Fonction helper pour gérer les erreurs Supabase
export const handleSupabaseError = (error) => {
  console.error('Erreur Supabase:', error);
  
  if (error.message.includes('Invalid login credentials')) {
    return 'Identifiants incorrects';
  }
  if (error.message.includes('Email not confirmed')) {
    return 'Email non confirmé';
  }
  if (error.message.includes('User not found')) {
    return 'Utilisateur introuvable';
  }
  if (error.message.includes('duplicate key')) {
    return 'Cet élément existe déjà';
  }
  
  return error.message || 'Une erreur est survenue';
};

// Fonction pour créer l'email fictif basé sur le numéro CP
export const createEmailFromCP = (numeroCP) => {
  return `${numeroCP.toLowerCase()}@catenaires-versailles.internal`;
};

// Fonction pour extraire le CP depuis l'email
export const extractCPFromEmail = (email) => {
  if (!email) return '';
  return email.split('@')[0].toUpperCase();
};