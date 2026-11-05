<template>
  <span class="stamp" :class="tone"><i></i>{{ text }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: '' },
  map: { type: Object, default: null },
  label: { type: String, default: '' },
  tone: { type: String, default: '' },
})

const entry = computed(() => (props.map ? props.map[props.status] : null))
const text = computed(() => props.label || entry.value?.label || props.status || '—')
const tone = computed(() => props.tone || entry.value?.tone || 'muted')
</script>
