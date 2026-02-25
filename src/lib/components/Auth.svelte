<script lang="ts">
	import { supabase } from '$lib/supabase/client';
	import { onMount } from 'svelte';

	let mode: 'signin' | 'signup' = 'signin';
	let email = '';
	let password = '';
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
			score = 0;
			label = '';
			color = '';
		} else if (metRequirements <= 2) {
			score = 1;
			label = 'Weak';
			color = 'text-red-400';
		} else if (metRequirements <= 3) {
			score = 2;
			label = 'Fair';
			color = 'text-yellow-400';
		} else if (metRequirements === 4) {
			score = 3;
			label = 'Good';
			color = 'text-blue-400';
		} else {
			score = 4;
			label = 'Strong';
			color = 'text-green-400';
		}

		passwordStrength = { score, label, color, requirements };
	}

	$: if (mode === 'signup') {
		validatePassword(password);
	}

	// Check lockout status
	function checkLockout(): boolean {
		if (lockoutUntil && Date.now() < lockoutUntil) {
			updateRemainingTime();
			return true;
		}
		if (lockoutUntil && Date.now() >= lockoutUntil) {
			// Lockout expired, reset
			resetLockout();
		}
		return false;
	}

	function updateRemainingTime() {
		if (!lockoutUntil) return;
		remainingLockoutTime = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
	}

	function startLockout() {
		lockoutUntil = Date.now() + LOCKOUT_DURATION;
		saveLockoutState();

		// Update countdown every second
		if (lockoutInterval) clearInterval(lockoutInterval);
		lockoutInterval = setInterval(() => {
			updateRemainingTime();
			if (remainingLockoutTime <= 0) {
				resetLockout();
			}
		}, 1000);
	}

	function resetLockout() {
		failedAttempts = 0;
		lockoutUntil = null;
		remainingLockoutTime = 0;
		if (lockoutInterval) {
			clearInterval(lockoutInterval);
			lockoutInterval = null;
		}
		saveLockoutState();
	}

	function saveLockoutState() {
		localStorage.setItem(
			'auth_lockout',
			JSON.stringify({
				failedAttempts,
				lockoutUntil
			})
		);
	}

	function loadLockoutState() {
		const saved = localStorage.getItem('auth_lockout');
		if (saved) {
			try {
				const data = JSON.parse(saved);
				failedAttempts = data.failedAttempts || 0;
				lockoutUntil = data.lockoutUntil || null;
				if (checkLockout()) {
					startLockout();
				}
			} catch {
				// Invalid data, ignore
			}
		}
	}

	function formatLockoutTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	async function handleSubmit() {
		if (!email || !password) {
			error = 'Please fill in all fields';
			return;
		}

		// Check lockout
		if (checkLockout()) {
			error = `Too many failed attempts. Try again in ${formatLockoutTime(remainingLockoutTime)}.`;
			return;
		}

		// Validate password strength for signup
		if (mode === 'signup') {
			const allRequirementsMet = Object.values(passwordStrength.requirements).every(Boolean);
			if (!allRequirementsMet) {
				error = 'Password does not meet security requirements';
				return;
			}
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
				resetLockout(); // Reset on successful signup
			} else {
				const { error: signInError } = await supabase.auth.signInWithPassword({
					email,
					password
				});

				if (signInError) {
					// Failed sign in
					failedAttempts++;
					saveLockoutState();

					if (failedAttempts >= MAX_ATTEMPTS) {
						startLockout();
						throw new Error(
							`Too many failed attempts. Account locked for ${LOCKOUT_DURATION / 60000} minutes.`
						);
					} else {
						throw new Error(
							`${signInError.message} (${MAX_ATTEMPTS - failedAttempts} attempts remaining)`
						);
					}
				}

				// Successful sign in
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
		error = '';
		message = '';
		password = '';
	}

	onMount(() => {
		loadLockoutState();
	});
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
	<div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full border border-gray-200 dark:border-gray-700">
		<div class="text-center mb-8">
			<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">🎮 GameTracker</h1>
			<p class="text-gray-600 dark:text-gray-400">Track your progress and finish what you started</p>
		</div>

		<form on:submit|preventDefault={handleSubmit} class="space-y-4">
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
							<span class="text-xs font-medium {passwordStrength.color}">
								{passwordStrength.label}
							</span>
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
								<span
									class="{passwordStrength.requirements.length
										? 'text-green-600 dark:text-green-400'
										: 'text-gray-400 dark:text-gray-500'}"
								>
									{passwordStrength.requirements.length ? '✓' : '○'}
								</span>
								<span class="text-gray-600 dark:text-gray-400">8+ characters</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span
									class="{passwordStrength.requirements.uppercase
										? 'text-green-600 dark:text-green-400'
										: 'text-gray-400 dark:text-gray-500'}"
								>
									{passwordStrength.requirements.uppercase ? '✓' : '○'}
								</span>
								<span class="text-gray-600 dark:text-gray-400">Uppercase (A-Z)</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span
									class="{passwordStrength.requirements.lowercase
										? 'text-green-600 dark:text-green-400'
										: 'text-gray-400 dark:text-gray-500'}"
								>
									{passwordStrength.requirements.lowercase ? '✓' : '○'}
								</span>
								<span class="text-gray-600 dark:text-gray-400">Lowercase (a-z)</span>
							</div>
							<div class="flex items-center gap-1.5">
								<span
									class="{passwordStrength.requirements.number ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}"
								>
									{passwordStrength.requirements.number ? '✓' : '○'}
								</span>
								<span class="text-gray-600 dark:text-gray-400">Number (0-9)</span>
							</div>
							<div class="flex items-center gap-1.5 col-span-2">
								<span
									class="{passwordStrength.requirements.special
										? 'text-green-600 dark:text-green-400'
										: 'text-gray-400 dark:text-gray-500'}"
								>
									{passwordStrength.requirements.special ? '✓' : '○'}
								</span>
								<span class="text-gray-600 dark:text-gray-400">Special character (!@#$...)</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

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
				{loading
					? 'Loading...'
					: lockoutUntil && remainingLockoutTime > 0
						? `Locked (${formatLockoutTime(remainingLockoutTime)})`
						: mode === 'signin'
							? 'Sign In'
							: 'Sign Up'}
			</button>
		</form>

		<div class="mt-6 text-center">
			<button
				on:click={toggleMode}
				disabled={loading}
				class="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm disabled:opacity-50"
			>
				{mode === 'signin'
					? "Don't have an account? Sign up"
					: 'Already have an account? Sign in'}
			</button>
		</div>
	</div>
</div>
