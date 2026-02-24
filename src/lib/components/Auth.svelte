<script lang="ts">
	import { supabase } from '$lib/supabase/client';

	let mode: 'signin' | 'signup' = 'signin';
	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let message = '';

	async function handleSubmit() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		loading = true;
		error = '';
		message = '';

		try {
			if (mode === 'signup') {
				const { error: signUpError } = await supabase.auth.signUp({
					email,
					password
				});

				if (signUpError) throw signUpError;

				message = 'Check your email for the confirmation link!';
				email = '';
				password = '';
			} else {
				const { error: signInError } = await supabase.auth.signInWithPassword({
					email,
					password
				});

				if (signInError) throw signInError;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Authentication failed';
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		mode = mode === 'signin' ? 'signup' : 'signin';
		error = '';
		message = '';
	}
</script>

<div class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
	<div class="bg-gray-800 rounded-lg p-8 max-w-md w-full">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-white mb-2">🎮 GameTracker</h1>
			<p class="text-gray-400">Track your progress and finish what you started</p>
		</div>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
			<div>
				<label for="email" class="block text-sm font-medium text-gray-300 mb-2">Email</label>
				<input
					id="email"
					type="email"
					bind:value={email}
					disabled={loading}
					placeholder="you@example.com"
					class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-300 mb-2">Password</label>
				<input
					id="password"
					type="password"
					bind:value={password}
					disabled={loading}
					placeholder="••••••••"
					class="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
				/>
			</div>

			{#if error}
				<div class="text-red-400 text-sm bg-red-900/20 border border-red-900 rounded-lg p-3">
					{error}
				</div>
			{/if}

			{#if message}
				<div class="text-green-400 text-sm bg-green-900/20 border border-green-900 rounded-lg p-3">
					{message}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
			>
				{loading ? 'Loading...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
			</button>
		</form>

		<div class="mt-6 text-center">
			<button
				on:click={toggleMode}
				disabled={loading}
				class="text-blue-400 hover:text-blue-300 text-sm disabled:opacity-50"
			>
				{mode === 'signin'
					? "Don't have an account? Sign up"
					: 'Already have an account? Sign in'}
			</button>
		</div>
	</div>
</div>
