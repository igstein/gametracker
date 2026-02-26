<script lang="ts">
	import { supabase } from '$lib/supabase/client';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let mode: 'signin' | 'signup' | 'forgot' = 'signin';
	let email = '';
	let password = '';
	let confirmPassword = '';
	let loading = false;
	let error = '';
	let message = '';

	// Password strength tracking
	let passwordStrength = {
		score: 0,
		label: '',
		color: '',
		requirements: {
			length: false,
			uppercase: false,
			lowercase: false,
			number: false,
			special: false
		}
	};

	// Rate limiting
	const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
	const MAX_ATTEMPTS = 5;
	let failedAttempts = 0;
	let lockoutUntil: number | null = null;
	let remainingLockoutTime = 0;
	let lockoutInterval: ReturnType<typeof setInterval> | null = null;

	// Password validation
	function validatePassword(pwd: string) {
		const requirements = {
			length: pwd.length >= 8,
			uppercase: /[A-Z]/.test(pwd),
			lowercase: /[a-z]/.test(pwd),
			number: /[0-9]/.test(pwd),
			special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
		};

		const metRequirements = Object.values(requirements).filter(Boolean).length;

		let score = 0;
		let label = '';
		let color = '';

		if (metRequirements === 0) {
			score = 0; label = ''; color = '';
		} else if (metRequirements <= 2) {
			score = 1; label = 'Weak'; color = 'text-red-400';
		} else if (metRequirements <= 3) {
			score = 2; label = 'Fair'; color = 'text-yellow-400';
		} else if (metRequirements === 4) {
			score = 3; label = 'Good'; color = 'text-blue-400';
		} else {
			score = 4; label = 'Strong'; color = 'text-green-400';
		}

		passwordStrength = { score, label, color, requirements };
	}

	$: if (mode === 'signup') validatePassword(password);

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
				const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
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

		if (mode === 'signup') {
			const allRequirementsMet = Object.values(passwordStrength.requirements).every(Boolean);
			if (!allRequirementsMet) { error = 'Password does not meet security requirements'; return; }
			if (password !== confirmPassword) { error = 'Passwords do not match'; return; }
		}

		loading = true;

		try {
			if (mode === 'signup') {
				const { error: signUpError } = await supabase.auth.signUp({ email, password });
				if (signUpError) throw signUpError;
				message = 'Check your email for the confirmation link!';
				email = ''; password = ''; confirmPassword = '';
				resetLockout();
			} else {
				const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
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
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Authentication failed';
		} finally {
			loading = false;
		}
	}

	function toggleMode() {
		mode = mode === 'signin' ? 'signup' : 'signin';
		error = ''; message = ''; password = ''; confirmPassword = '';
	}

	function goToForgot() {
		mode = 'forgot';
		error = ''; message = ''; password = ''; confirmPassword = '';
	}

	function goToSignIn() {
		mode = 'signin';
		error = ''; message = ''; password = ''; confirmPassword = '';
	}

	onMount(() => { loadLockoutState(); });
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
	<div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full border border-gray-200 dark:border-gray-700">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">🎮 GameTracker</h1>
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
				<!-- Sign In / Sign Up -->
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

					{#if mode === 'signup' && password}
						<!-- Password Strength Indicator -->
						<div class="mt-2">
							<div class="flex items-center justify-between mb-1">
								<span class="text-xs text-gray-600 dark:text-gray-400">Password strength:</span>
								<span class="text-xs font-medium {passwordStrength.color}">{passwordStrength.label}</span>
							</div>
							<div class="w-full h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
								<div
									class="h-full transition-all duration-300 {passwordStrength.score === 1
										? 'bg-red-500 w-1/4'
										: passwordStrength.score === 2
											? 'bg-yellow-500 w-2/4'
											: passwordStrength.score === 3
												? 'bg-blue-500 w-3/4'
												: passwordStrength.score === 4
													? 'bg-green-500 w-full'
													: 'w-0'}"
								></div>
							</div>
						</div>

						<!-- Password Requirements -->
						<div class="mt-3 space-y-1">
							<p class="text-xs text-gray-600 dark:text-gray-400 mb-1">Requirements:</p>
							<div class="grid grid-cols-2 gap-1 text-xs">
								<div class="flex items-center gap-1.5">
									<span class="{passwordStrength.requirements.length ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
										{passwordStrength.requirements.length ? '✓' : '○'}
									</span>
									<span class="text-gray-600 dark:text-gray-400">8+ characters</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="{passwordStrength.requirements.uppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
										{passwordStrength.requirements.uppercase ? '✓' : '○'}
									</span>
									<span class="text-gray-600 dark:text-gray-400">Uppercase (A-Z)</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="{passwordStrength.requirements.lowercase ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
										{passwordStrength.requirements.lowercase ? '✓' : '○'}
									</span>
									<span class="text-gray-600 dark:text-gray-400">Lowercase (a-z)</span>
								</div>
								<div class="flex items-center gap-1.5">
									<span class="{passwordStrength.requirements.number ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
										{passwordStrength.requirements.number ? '✓' : '○'}
									</span>
									<span class="text-gray-600 dark:text-gray-400">Number (0-9)</span>
								</div>
								<div class="flex items-center gap-1.5 col-span-2">
									<span class="{passwordStrength.requirements.special ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}">
										{passwordStrength.requirements.special ? '✓' : '○'}
									</span>
									<span class="text-gray-600 dark:text-gray-400">Special character (!@#$...)</span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Confirm Password (signup only) -->
				{#if mode === 'signup'}
					<div>
						<label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
							disabled={loading}
							placeholder="••••••••"
							class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50
								{confirmPassword && password !== confirmPassword ? 'border-red-400 dark:border-red-500' : ''}
								{confirmPassword && password === confirmPassword ? 'border-green-400 dark:border-green-500' : ''}"
						/>
						{#if confirmPassword && password !== confirmPassword}
							<p class="text-xs text-red-500 mt-1">Passwords do not match</p>
						{/if}
					</div>
				{/if}
			{/if}

			{#if error}
				<div class="text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
					{error}
					{#if lockoutUntil && remainingLockoutTime > 0}
						<div class="mt-2 text-xs text-red-600 dark:text-red-300">
							⏱ Retry in: {formatLockoutTime(remainingLockoutTime)}
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
				{:else if mode === 'signup'}
					Sign Up
				{:else}
					Send Reset Email
				{/if}
			</button>
		</form>

		<div class="mt-6 space-y-2 text-center">
			{#if mode === 'signin'}
				<div>
					<button on:click={goToForgot} disabled={loading} class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm disabled:opacity-50">
						Forgot password?
					</button>
				</div>
				<div>
					<button on:click={toggleMode} disabled={loading} class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm disabled:opacity-50">
						Don't have an account? Sign up
					</button>
				</div>
			{:else}
				<div>
					<button on:click={goToSignIn} disabled={loading} class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm disabled:opacity-50">
						Back to sign in
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>
