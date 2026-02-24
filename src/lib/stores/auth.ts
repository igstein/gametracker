import { writable } from 'svelte/store';
import { supabase } from '$lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
	user: User | null;
	session: Session | null;
	loading: boolean;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		loading: true
	});

	return {
		subscribe,
		setUser: (user: User | null, session: Session | null) => {
			set({ user, session, loading: false });
		},
		setLoading: (loading: boolean) => {
			update((state) => ({ ...state, loading }));
		},
		signOut: async () => {
			await supabase.auth.signOut();
			set({ user: null, session: null, loading: false });
		}
	};
}

export const authStore = createAuthStore();

// Initialize auth state and listen for changes
export async function initAuth() {
	// Get initial session
	const {
		data: { session }
	} = await supabase.auth.getSession();

	authStore.setUser(session?.user ?? null, session);

	// Listen for auth changes
	supabase.auth.onAuthStateChange((_event, session) => {
		authStore.setUser(session?.user ?? null, session);
	});
}
