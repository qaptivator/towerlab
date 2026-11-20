<script setup lang="ts">
import {
	convertDocument,
	type ConvertTarget,
	type ConversionWarning,
} from '../../../../packages/kit-engine/src'
import { serializeRbxm } from '@towerlab/wasm-bridge'
import { downloadBytes, rbxmName } from '../utils/format'

useHead({ title: 'Convert · TowerLab' })

const { loaded, status, error, loadFile, clear } = useRobloxFile()
const { setSummary } = useDiagnostics()
const target = ref<ConvertTarget>('clean-rbxm')
const warnings = ref<ConversionWarning[]>([])
const converting = ref(false)
const convertError = ref<string | null>(null)

const targets: { id: ConvertTarget; label: string; hint?: string }[] = [
	{ id: 'etoh-v6', label: 'EToH v6 Kit (.rbxm)' },
	{ id: 'clean-rbxm', label: 'Clean .rbxm Package', hint: 'Ready' },
]

watch(
	loaded,
	(file) => {
		warnings.value = []
		convertError.value = null
		if (!file) {
			setSummary('No file loaded.')
			return
		}
		setSummary(
			[
				`File: ${file.name} (${file.size} bytes)`,
				`Kind: ${file.kit.label}`,
				`Format: ${file.document.format}`,
				`Instances: ${file.stats.instances}`,
				`Obby parts: ${file.stats.obbyParts}`,
				`Client object parts: ${file.stats.clientObjectParts}`,
				`Frame parts: ${file.stats.frameParts}`,
				`Total parts: ${file.stats.parts}`,
				`Target: ${target.value}`,
				error.value ? `Error: ${error.value}` : 'Error: none',
			].join('\n')
		)
	},
	{ immediate: true }
)

watch(target, (value) => {
	if (!loaded.value) return
	setSummary(
		`File: ${loaded.value.name}\nTarget: ${value}\nKind: ${loaded.value.kit.label}`
	)
})

async function convert() {
	if (!loaded.value || converting.value) return
	converting.value = true
	convertError.value = null
	const result = convertDocument(loaded.value.document, target.value)
	warnings.value = result.warnings
	try {
		if (!result.download) return
		const bytes = await serializeRbxm(result.document)
		downloadBytes(bytes, rbxmName(loaded.value.name))
	} catch (cause) {
		convertError.value =
			cause instanceof Error ? cause.message : "Couldn't write the .rbxm."
	} finally {
		converting.value = false
	}
}
</script>

<template>
	<div
		class="relative mx-auto flex w-full max-w-3xl flex-col px-4 py-10 md:py-16"
	>
		<div
			class="pointer-events-none absolute left-1/2 top-32 h-80 w-80 -translate-x-1/2 rounded-full bg-mint/5 blur-3xl"
		/>
		<header class="mb-8 text-center">
			<h1
				class="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl"
			>
				Convert a tower file
			</h1>
			<p class="mt-2 text-sm text-muted md:text-base">
				Repackage a place or model. EToH v6 conversion comes next.
			</p>
		</header>

		<div class="flex flex-col gap-6">
			<FileDropzone
				v-if="!loaded"
				title="Drop a place or model file"
				:busy="status === 'loading'"
				@file="loadFile"
			/>
			<FileSummary
				v-else
				:file="loaded"
				@clear="clear"
			/>
			<p
				v-if="error"
				class="text-center text-sm text-danger"
			>
				{{ error }}
			</p>

			<div class="flex flex-col gap-2">
				<p class="px-1 text-sm text-dim">Target output</p>
				<div
					class="flex flex-col gap-1.5 rounded-xl bg-subtle p-1.5 sm:flex-row"
				>
					<button
						v-for="option in targets"
						:key="option.id"
						class="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-center font-mono text-xs transition sm:text-sm"
						:class="
							target === option.id
								? 'bg-raised text-ink shadow-sm'
								: 'text-muted hover:text-ink'
						"
						type="button"
						@click="target = option.id"
					>
						<span>{{ option.label }}</span>
						<span
							v-if="option.hint"
							class="text-[10px] uppercase tracking-wider text-mint"
							>{{ option.hint }}</span
						>
					</button>
				</div>
			</div>

			<button
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-mint py-3.5 font-mono text-sm font-medium text-canvas shadow-mint transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
				type="button"
				:disabled="!loaded || status === 'loading' || converting"
				@click="convert"
			>
				{{ converting ? 'Working…' : 'Convert file' }}
				<span class="material-symbols-outlined text-[18px]">arrow_forward</span>
			</button>

			<ul
				v-if="warnings.length"
				class="flex flex-col gap-2"
			>
				<li
					v-for="warning in warnings"
					:key="warning.message"
					class="rounded-xl border border-border-subtle bg-subtle px-4 py-3 text-sm"
					:class="warning.severity === 'warning' ? 'text-ink' : 'text-muted'"
				>
					{{ warning.message }}
				</li>
			</ul>
			<p
				v-if="convertError"
				class="text-sm text-danger"
			>
				{{ convertError }}
			</p>

			<p
				class="flex items-center justify-center gap-2 pb-2 text-center text-sm text-dim"
			>
				<span class="material-symbols-outlined text-[16px]">lock</span>
				All processing happens locally in your browser. Nothing is uploaded to
				any server.
			</p>
		</div>
	</div>
</template>
