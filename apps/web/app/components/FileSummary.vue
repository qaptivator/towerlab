<script setup lang="ts">
import { detectSource, documentStats } from '../../../../packages/kit-engine/src'
import type { LoadedRobloxFile } from '../composables/useRobloxFile'
import { formatBytes, formatCount } from '../utils/format'

const props = defineProps<{
	file: LoadedRobloxFile
}>()

defineEmits<{
	clear: []
}>()

const detection = computed(() => detectSource(props.file.document))
const stats = computed(() => documentStats(props.file.document))

const counters = computed(() => [
	{ label: 'Obby', hint: 'Highest Obby folder', value: stats.value.obbyParts },
	{ label: 'Client parts', hint: 'ClientSidedObjects', value: stats.value.clientObjectParts },
	{ label: 'Frame parts', hint: 'Frame folder', value: stats.value.frameParts },
	{ label: 'Total parts', hint: 'Whole file', value: stats.value.parts },
	{ label: 'Client objects', hint: 'Models and folders', value: stats.value.clientObjects },
	{ label: 'Floors', hint: 'Under Frame', value: stats.value.floors },
	{ label: 'Music zones', hint: 'Under Music', value: stats.value.musicZones },
	{ label: 'Unique music', hint: 'Distinct ids', value: stats.value.uniqueMusic },
])
</script>

<template>
	<div class="flex w-full flex-col gap-5 rounded-xl bg-subtle p-5 sm:p-6">
		<div class="flex items-start justify-between gap-3">
			<div class="flex min-w-0 items-center gap-4">
				<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-container text-mint">
					<span class="material-symbols-outlined text-[26px]">inventory_2</span>
				</div>
				<div class="min-w-0">
					<p class="truncate font-mono text-base text-ink sm:text-lg">{{ file.name }}</p>
					<p class="mt-1 text-sm text-dim">
						{{ formatBytes(file.size) }}
						<span class="mx-1.5">·</span>
						{{ detection.label }}
						<span class="mx-1.5">·</span>
						{{ formatCount(stats.instances) }} instances
					</p>
				</div>
			</div>
			<button
				class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-dim hover:bg-container hover:text-ink"
				type="button"
				aria-label="Remove file"
				@click="$emit('clear')"
			>
				<span class="material-symbols-outlined text-[18px]">close</span>
			</button>
		</div>

		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			<div v-for="counter in counters" :key="counter.label" class="rounded-xl bg-canvas px-4 py-4">
				<dd class="font-mono text-3xl font-medium tracking-tight text-ink sm:text-4xl">
					{{ formatCount(counter.value) }}
				</dd>
				<dt class="mt-2 text-sm text-ink">{{ counter.label }}</dt>
				<p class="mt-0.5 text-xs text-dim">{{ counter.hint }}</p>
			</div>
		</dl>
	</div>
</template>
