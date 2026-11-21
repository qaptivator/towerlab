<script setup lang="ts">
import {
	convertDocument,
	detectSource,
	documentStats,
	pipelineLabel,
	type OutputShape,
	type TargetKit,
} from '../../../../packages/kit-engine/src'
import { serializeRbxm } from '@towerlab/wasm-bridge'
import { downloadBytes, formatBytes, rbxlName, rbxmName } from '../utils/format'

useHead({ title: 'Convert · TowerLab' })

const { loaded, status, error, loadFile, clear } = useRobloxFile()
const { setSummary } = useDiagnostics()

const target = ref<TargetKit>('etoh-6')
const shape = ref<OutputShape>('model')
const warnings = ref<string[]>([])
const converting = ref(false)
const convertError = ref<string | null>(null)

const detection = computed(() =>
	loaded.value ? detectSource(loaded.value.document) : null
)
const stats = computed(() =>
	loaded.value ? documentStats(loaded.value.document) : null
)
const plan = computed(() =>
	detection.value
		? pipelineLabel(detection.value.kit, target.value, shape.value)
		: ''
)

const statRows = computed(() => {
	const value = stats.value
	if (!value) return []
	return [
		['Instances', value.instances],
		['Parts', value.parts],
		['Obby parts', value.obbyParts],
		['Client object parts', value.clientObjectParts],
		['Frame parts', value.frameParts],
		['Client objects', value.clientObjects],
		['Floors', value.floors],
		['Music zones', value.musicZones],
		['Unique music', value.uniqueMusic],
	] as const
})

const targets: { id: TargetKit; label: string }[] = [
	{ id: 'etoh-6', label: 'EToH v6' },
	{ id: 'jtoh-5.5', label: 'JToH 5.5' },
]

const shapes: { id: OutputShape; label: string; detail: string }[] = [
	{
		id: 'place',
		label: 'Place',
		detail: 'Place file with scripts for instant play.',
	},
	{
		id: 'model',
		label: 'Model',
		detail: 'Model file with the tower kit and its music.',
	},
]

watch(
	[loaded, target, shape],
	() => {
		warnings.value = []
		convertError.value = null
		const file = loaded.value
		if (!file || !detection.value || !stats.value) {
			setSummary('No file loaded.')
			return
		}
		setSummary(
			[
				`File: ${file.name} (${file.size} bytes)`,
				`Kit: ${detection.value.label}`,
				`Format: ${file.document.format}`,
				`Plan: ${plan.value}`,
				`Instances: ${stats.value.instances}`,
				`Floors: ${stats.value.floors}`,
				`Music zones: ${stats.value.musicZones}`,
				`Unique music: ${stats.value.uniqueMusic}`,
				error.value ? `Error: ${error.value}` : 'Error: none',
			].join('\n')
		)
	},
	{ immediate: true }
)

async function convert() {
	if (!loaded.value || !detection.value || converting.value) return
	if (detection.value.kit === 'unknown') return
	converting.value = true
	convertError.value = null
	try {
		const result = convertDocument(loaded.value.document, target.value, shape.value)
		warnings.value = result.warnings.map((warning) => warning.message)
		if (!result.download) return
		const bytes = await serializeRbxm(result.document)
		const name =
			shape.value === 'place' ? rbxlName(loaded.value.name) : rbxmName(loaded.value.name)
		downloadBytes(bytes, name)
	} catch (cause) {
		convertError.value =
			cause instanceof Error ? cause.message : "Couldn't write the file."
	} finally {
		converting.value = false
	}
}
</script>

<template>
	<div class="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
		<header>
			<h1 class="font-display text-2xl font-semibold text-ink">Convert</h1>
		</header>

		<section class="flex flex-col gap-3">
			<h2 class="text-sm text-dim">File</h2>
			<FileDropzone
				v-if="!loaded"
				title="Drop a place or model file"
				:busy="status === 'loading'"
				@file="loadFile"
			/>
			<div v-else class="flex flex-col gap-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="truncate font-mono text-sm text-ink">{{ loaded.name }}</p>
						<p class="mt-1 text-sm text-dim">
							{{ formatBytes(loaded.size) }}
							<span class="mx-1.5">·</span>
							{{ loaded.document.format }}
						</p>
					</div>
					<button
						class="text-sm text-dim hover:text-ink"
						type="button"
						@click="clear"
					>
						Remove
					</button>
				</div>
				<div>
					<p class="text-xs uppercase tracking-wider text-dim">Kit</p>
					<p class="mt-1 text-xl text-ink">{{ detection?.label }}</p>
				</div>
				<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
					<template v-for="[label, value] in statRows" :key="label">
						<dt class="text-dim">{{ label }}</dt>
						<dd class="font-mono text-ink">{{ value }}</dd>
					</template>
				</dl>
			</div>
			<p v-if="error" class="text-sm text-danger">{{ error }}</p>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="text-sm text-dim">Target version</h2>
			<div class="flex gap-2">
				<button
					v-for="option in targets"
					:key="option.id"
					class="rounded-lg px-3 py-2 text-sm"
					:class="target === option.id ? 'bg-subtle text-ink' : 'text-muted'"
					type="button"
					:aria-pressed="target === option.id"
					@click="target = option.id"
				>
					{{ option.label }}
				</button>
			</div>
			<p class="text-sm text-dim">
				Every file is converted to EToH v6 first. JToH 5.5 is a downgrade from that.
			</p>
		</section>

		<section class="flex flex-col gap-2">
			<h2 class="text-sm text-dim">Output</h2>
			<div class="flex gap-2">
				<button
					v-for="option in shapes"
					:key="option.id"
					class="rounded-lg px-3 py-2 text-sm"
					:class="shape === option.id ? 'bg-subtle text-ink' : 'text-muted'"
					type="button"
					:aria-pressed="shape === option.id"
					@click="shape = option.id"
				>
					{{ option.label }}
				</button>
			</div>
			<p class="text-sm text-dim">
				{{ shapes.find((option) => option.id === shape)?.detail }}
			</p>
		</section>

		<section class="flex flex-col gap-3">
			<p v-if="plan" class="font-mono text-sm text-ink">{{ plan }}</p>
			<button
				class="rounded-lg bg-mint px-3 py-2 text-sm font-medium text-canvas disabled:cursor-not-allowed disabled:opacity-50"
				type="button"
				:disabled="!loaded || detection?.kit === 'unknown' || status === 'loading' || converting"
				@click="convert"
			>
				{{ converting ? 'Working…' : 'Export' }}
			</button>
			<p
				v-for="warning in warnings"
				:key="warning"
				class="text-sm text-ink"
			>
				{{ warning }}
			</p>
			<p v-if="convertError" class="text-sm text-danger">{{ convertError }}</p>
		</section>
	</div>
</template>
