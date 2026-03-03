<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let mode: 'signin' | 'forgot' = 'signin';
	let email = '';
	let password = '';
	let loading = false;
	let error = '';
	let message = '';

	// Rate limiting
	const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
	const MAX_ATTEMPTS = 5;
	let failedAttempts = 0;
	let lockoutUntil: number | null = null;
	let remainingLockoutTime = 0;
	let lockoutInterval: ReturnType<typeof setInterval> | null = null;

	// Check lockout status
	function checkLockout(): boolean {
		if (lockoutUntil && Date.now() < lockoutUntil) {
			updateRemainingTime();
			return true;
		}
		if (lockoutUntil && Date.now() >= lockoutUntil) resetLockout();
		return false;
	}

	function updateRemainingTime() {
		if (!lockoutUntil) return;
		remainingLockoutTime = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
	}

	function startLockout() {
		lockoutUntil = Date.now() + LOCKOUT_DURATION;
		saveLockoutState();
		if (lockoutInterval) clearInterval(lockoutInterval);
		lockoutInterval = setInterval(() => {
			updateRemainingTime();
			if (remainingLockoutTime <= 0) resetLockout();
		}, 1000);
	}

	function resetLockout() {
		failedAttempts = 0;
		lockoutUntil = null;
		remainingLockoutTime = 0;
		if (lockoutInterval) { clearInterval(lockoutInterval); lockoutInterval = null; }
		saveLockoutState();
	}

	function saveLockoutState() {
		localStorage.setItem('auth_lockout', JSON.stringify({ failedAttempts, lockoutUntil }));
	}

	function loadLockoutState() {
		const saved = localStorage.getItem('auth_lockout');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				failedAttempts = data.failedAttempts || 0;
				lockoutUntil = data.lockoutUntil || null;
				if (checkLockout()) startLockout();
			} catch { /* ignore */ }
		}
	}

	function formatLockoutTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	async function handleSubmit() {
		error = '';
		message = '';

		if (mode === 'forgot') {
			if (!email) { error = 'Please enter your email'; return; }
			loading = true;
			try {
				const redirectTo = browser ? window.location.origin : undefined;
				const { error: resetError } = await $page.data.supabase.auth.resetPasswordForEmail(email, {
					redirectTo
				});
				if (resetError) throw resetError;
				message = 'Check your email for the password reset link.';
				email = '';
			} catch (e) {
				error = e instanceof Error ? e.message : 'Failed to send reset email';
			} finally {
				loading = false;
			}
			return;
		}

		if (!email || !password) { error = 'Please fill in all fields'; return; }

		if (checkLockout()) {
			error = `Too many failed attempts. Try again in ${formatLockoutTime(remainingLockoutTime)}.`;
			return;
		}

		loading = true;

		try {
			const { error: signInError } = await $page.data.supabase.auth.signInWithPassword({ email, password });
			if (signInError) {
				failedAttempts++;
				saveLockoutState();
				if (failedAttempts >= MAX_ATTEMPTS) {
					startLockout();
					throw new Error(`Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`);
				} else {
					throw new Error(`${signInError.message} (${MAX_ATTEMPTS - failedAttempts} attempts remaining)`);
				}
			}
			resetLockout();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Authentication failed';
		} finally {
			loading = false;
		}
	}

	function goToForgot() {
		mode = 'forgot';
		error = ''; message = ''; password = '';
	}

	function goToSignIn() {
		mode = 'signin';
		error = ''; message = ''; password = '';
	}

	onMount(() => { loadLockoutState(); });
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
	<div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full border border-gray-200 dark:border-gray-700">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">GameTracker</h1>
			<p class="text-gray-600 dark:text-gray-400">Track your progress and finish what you started</p>
		</div>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">

			{#if mode === 'forgot'}
				<!-- Forgot Password -->
				<p class="text-sm text-gray-600 dark:text-gray-400 text-center">
					Enter your email and we'll send you a reset link.
				</p>
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						disabled={loading}
						placeholder="you@example.com"
						class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
					/>
				</div>

			{:else}
				<!-- Sign In -->
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						disabled={loading}
						placeholder="you@example.com"
						class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
					/>
				</div>

				<div>
					<label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						disabled={loading}
						placeholder="••••••••"
						class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
					/>
				</div>
			{/if}

			{#if error}
				<div class="text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
					{error}
					{#if lockoutUntil && remainingLockoutTime > 0}
						<div class="mt-2 text-xs text-red-600 dark:text-red-300">
							Retry in: {formatLockoutTime(remainingLockoutTime)}
						</div>
					{/if}
				</div>
			{/if}

			{#if message}
				<div class="text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-3">
					{message}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading || (lockoutUntil !== null && remainingLockoutTime > 0)}
				class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{#if loading}
					Loading...
				{:else if lockoutUntil && remainingLockoutTime > 0}
					Locked ({formatLockoutTime(remainingLockoutTime)})
				{:else if mode === 'signin'}
					Sign In
				{:else}
					Send Reset Email
				{/if}
			</button>
		</form>

		<div class="mt-6 text-center">
			{#if mode === 'signin'}
				<button on:click={goToForgot} disabled={loading} class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm disabled:opacity-50">
					Forgot password?
				</button>
			{:else}
				<button on:click={goToSignIn} disabled={loading} class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm disabled:opacity-50">
					Back to sign in
				</button>
			{/if}
		</div>
	</div>
</div>
