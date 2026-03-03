import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface PageData {
			supabase: SupabaseClient;
			session: Session | null;
			user: User | null;
		}
	}
}

export {};
