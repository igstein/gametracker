import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
	requiresPasswordReset: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		loading: true,
		requiresPasswordReset: false
	});

	return {
		subscribe,
		setUser: (user: User | null, session: Session | null) => {
			set({ user, session, loading: false, requiresPasswordReset: false });
		},
		setLoading: (loading: boolean) => {
			update((state) => ({ ...state, loading }));
		},
		setPasswordRecovery: (user: User | null, session: Session | null) => {
			set({ user, session, loading: false, requiresPasswordReset: true });
		},
		clearPasswordRecovery: () => {
			update((state) => ({ ...state, requiresPasswordReset: false }));
		},
		signOut: async () => {
			await supabase.auth.signOut();
			set({ user: null, session: null, loading: false, requiresPasswordReset: false });
		}
	};
}

export const authStore = createAuthStore();

// Set up listener at module load time — must happen before initAuth()
// so we never miss the PASSWORD_RECOVERY event regardless of timing
supabase.auth.onAuthStateChange((event, session) => {
	if (event === 'PASSWORD_RECOVERY') {
		authStore.setPasswordRecovery(session?.user ?? null, session);
	} else {
		authStore.setUser(session?.user ?? null, session);
	}
});

export async function initAuth() {
	const {
		data: { session }
	} = await supabase.auth.getSession();

	// Only set user from session if we're not already in password recovery mode
	// (the onAuthStateChange above handles PASSWORD_RECOVERY)
	authStore.update((state) => {
		if (state.requiresPasswordReset) return state;
		return { ...state, user: session?.user ?? null, session, loading: false };
	});
}
