import { writable } from 'svelte/store';

// Tracks whether the password reset modal should be shown.
// Set to true when Supabase fires the PASSWORD_RECOVERY auth event.
export const requiresPasswordReset = writable(false);
