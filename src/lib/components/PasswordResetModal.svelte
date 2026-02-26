<script lang="ts">
	import { supabase } from '$lib/supabase/client';
	import { authStore } from '$lib/stores/auth';

	let password = '';
	let confirmPassword = '';
	let loading = false;
	let error = '';
	let success = false;

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

	function validatePassword(pwd: string) {
		const requirements = {
			length: pwd.length >= 8,
			uppercase: /[A-Z]/.test(pwd),
			lowercase: /[a-z]/.test(pwd),
			number: /[0-9]/.test(pwd),
			special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
		};
		const met = Object.values(requirements).filter(Boolean).length;
		let score = 0, label = '', color = '';
		if (met <= 2 && met > 0) { score = 1; label = 'Weak'; color = 'text-red-400'; }
		else if (met === 3) { score = 2; label = 'Fair'; color = 'text-yellow-400'; }
		else if (met === 4) { score = 3; label = 'Good'; color = 'text-blue-400'; }
		else if (met === 5) { score = 4; label = 'Strong'; color = 'text-green-400'; }
		passwordStrength = { score, label, color, requirements };
	}

	$: validatePassword(password);

	async function handleSubmit() {
		error = '';

		const allMet = Object.values(passwordStrength.requirements).every(Boolean);
		if (!allMet) { error = 'Password does not meet security requirements'; return; }
		if (password !== confirmPassword) { error = 'Passwords do not match'; return; }

		loading = true;
		try {
			const { error: updateError } = await supabase.auth.updateUser({ password });
			if (updateError) throw updateError;
			success = true;
			setTimeout(() => authStore.clearPasswordRecovery(), 1500);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update password';
		} finally {
			loading = false;
		}
	}
</script>

<div class="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
	<div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full border border-gray-200 dark:border-gray-700">
		<div class="text-center mb-6">
			<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-1">Set New Password</h2>
			<p class="text-gray-600 dark:text-gray-400 text-sm">Choose a new password for your account.</p>
		</div>

		{#if success}
			<div class="text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 rounded-lg p-4 text-center">
				Password updated successfully! Redirecting...
			</div>
		{:else}
			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
				<div>
					<label for="new-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">New Password</label>
					<input
						id="new-password"
						type="password"
						bind:value={password}
						disabled={loading}
						placeholder="••••••••"
						class="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
					/>

					{#if password}
						<div class="mt-2">
							<div class="flex items-center justify-between mb-1">
								<span class="text-xs text-gray-600 dark:text-gray-400">Strength:</span>
								<span class="text-xs font-medium {passwordStrength.color}">{passwordStrength.label}</span>
							</div>
							<div class="w-full h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
								<div class="h-full transition-all duration-300 {passwordStrength.score === 1 ? 'bg-red-500 w-1/4' : passwordStrength.score === 2 ? 'bg-yellow-500 w-2/4' : passwordStrength.score === 3 ? 'bg-blue-500 w-3/4' : passwordStrength.score === 4 ? 'bg-green-500 w-full' : 'w-0'}"></div>
							</div>
						</div>
					{/if}
				</div>

				<div>
					<label for="confirm-new-password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Confirm Password</label>
					<input
						id="confirm-new-password"
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

				{#if error}
					<div class="text-red-700 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
						{error}
					</div>
				{/if}

				<button
					type="submit"
					disabled={loading}
					class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
				>
					{loading ? 'Updating...' : 'Update Password'}
				</button>
			</form>
		{/if}
	</div>
</div>
