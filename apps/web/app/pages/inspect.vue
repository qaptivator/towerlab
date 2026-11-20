<script setup lang="ts">
import type { RbxNode } from '@towerlab/dom-schema'
import { documentTree, indexNodes } from '../../../../packages/kit-engine/src-2'
import { serializeRbxm } from '@towerlab/wasm-bridge'
import {
	downloadBytes,
	downloadJson,
	jsonName,
	rbxmName,
} from '../utils/format'

useHead({ title: 'Inspect · TowerLab' })

const { loaded, status, error, loadFile, clear } = useRobloxFile()
const { setSummary } = useDiagnostics()
const selectedId = ref<string | null>(null)
const exporting = ref(false)
const exportError = ref<string | null>(null)

const selected = computed<RbxNode | null>(() => {
	if (!loaded.value || !selectedId.value) return null
	return indexNodes(loaded.value.document).get(selectedId.value) ?? null
})

watch(
	loaded,
	(file) => {
		selectedId.value = file?.document.rootIds[0] ?? null
		exportError.value = null
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
				file.document.diagnostics.length
					? `Parser notes: ${file.document.diagnostics.slice(0, 8).join(' | ')}`
					: 'Parser notes: none',
				error.value ? `Error: ${error.value}` : 'Error: none',
			].join('\n')
		)
	},
	{ immediate: true }
)

function exportTree() {
	if (!loaded.value) return
	downloadJson(
		documentTree(loaded.value.document),
		jsonName(loaded.value.name, 'tree')
	)
}

function exportSelection() {
	if (!loaded.value || !selectedId.value) return
	downloadJson(
		documentTree(loaded.value.document, [selectedId.value]),
		jsonName(loaded.value.name, 'selection')
	)
}

async function download() {
	if (!loaded.value) return
	exporting.value = true
	exportError.value = null
	try {
		const bytes = await serializeRbxm(loaded.value.document)
		downloadBytes(bytes, rbxmName(loaded.value.name))
	} catch (cause) {
		exportError.value =
			cause instanceof Error ? cause.message : "Couldn't write the .rbxm."
	} finally {
		exporting.value = false
	}
}

function reset() {
	clear()
	selectedId.value = null
}
</script>

<template>
	<div
		class="mx-auto flex w-full max-w-7xl flex-col px-4 py-8 md:px-8 md:py-12"
	>
		<header
			class="mx-auto mb-8 max-w-xl text-center"
			:class="loaded ? 'md:mx-0 md:max-w-none md:text-left' : ''"
		>
			<h1
				class="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl"
			>
				Inspect a place
			</h1>
			<p class="mt-2 text-sm text-muted md:text-base">
				Drop a Roblox file to see its hierarchy, counts, and properties.
			</p>
		</header>

		<div
			v-if="!loaded"
			class="relative mx-auto w-full max-w-3xl"
		>
			<div
				class="pointer-events-none absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint/5 blur-3xl"
			/>
			<FileDropzone
				title="Drop a place or model file"
				:busy="status === 'loading'"
				@file="loadFile"
			/>
			<p
				v-if="error"
				class="mt-4 text-center text-sm text-danger"
			>
				{{ error }}
			</p>
			<p
				class="mt-6 flex items-center justify-center gap-2 text-center text-sm text-dim"
			>
				<span class="material-symbols-outlined text-[16px]">lock</span>
				All processing happens locally in your browser. Nothing is uploaded to
				any server.
			</p>
		</div>

		<div
			v-else
			class="flex flex-col gap-4"
		>
			<FileSummary
				:file="loaded"
				@clear="reset"
			/>
			<div class="flex flex-wrap items-center justify-end gap-2">
				<p
					v-if="loaded.document.diagnostics.length"
					class="mr-auto text-xs text-dim"
				>
					{{ loaded.document.diagnostics.length }} properties were skipped
				</p>
				<button
					class="rounded-xl bg-raised px-4 py-2.5 font-mono text-sm text-ink hover:bg-container-high"
					type="button"
					@click="exportTree"
				>
					Export tree
				</button>
				<button
					class="rounded-xl bg-raised px-4 py-2.5 font-mono text-sm text-ink hover:bg-container-high disabled:cursor-not-allowed disabled:opacity-50"
					type="button"
					:disabled="!selected"
					@click="exportSelection"
				>
					Export selection
				</button>
				<button
					class="rounded-xl bg-mint px-4 py-2.5 font-mono text-sm font-medium text-canvas shadow-mint transition active:scale-[0.99] disabled:opacity-60"
					type="button"
					:disabled="exporting"
					@click="download"
				>
					{{ exporting ? 'Packaging…' : 'Download .rbxm' }}
				</button>
			</div>
			<p
				v-if="exportError"
				class="text-sm text-danger"
			>
				{{ exportError }}
			</p>
			<div
				class="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]"
			>
				<InstanceTree
					:document="loaded.document"
					:selected-id="selectedId"
					@select="selectedId = $event"
				/>
				<PropertyPanel :node="selected" />
			</div>
		</div>
	</div>
</template>
