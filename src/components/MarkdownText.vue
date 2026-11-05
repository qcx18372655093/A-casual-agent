<template>
  <div class="md" :class="{ typing }" v-html="html"></div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({
  text: { type: String, default: '' },
  typing: { type: Boolean, default: false },
})

marked.setOptions({ breaks: true, gfm: true })

const html = computed(() => {
  try {
    return marked.parse(props.text || '')
  } catch {
    return props.text
  }
})
</script>
