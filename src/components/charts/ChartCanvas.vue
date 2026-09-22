<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Chart as ChartInstance, ChartConfiguration } from 'chart.js'
import { useTheme } from '@/composables/useTheme'

export interface ChartSeries {
  label: string
  data: number[]
  /** One colour for the series, or one per bar/slice. */
  color: string | string[]
  /** Dashed line — used for estimates against actual spending. */
  dashed?: boolean
}

const props = defineProps<{
  kind: 'bar' | 'line' | 'doughnut'
  labels: string[]
  series: ChartSeries[]
  /** Formats tooltip and axis values, e.g. money in the group currency. */
  format: (value: number) => string
  horizontal?: boolean
  height?: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const chart = shallowRef<ChartInstance | null>(null)
const failed = ref(false)
const { theme } = useTheme()

// Chart.js is only needed on the statistics tab, so it is fetched on first
// use instead of weighing down every other page.
let loader: Promise<typeof import('chart.js')> | null = null
function loadChartJs() {
  loader ??= import('chart.js').then((mod) => {
    mod.Chart.register(
      mod.BarController, mod.LineController, mod.DoughnutController,
      mod.BarElement, mod.LineElement, mod.PointElement, mod.ArcElement,
      mod.CategoryScale, mod.LinearScale, mod.Tooltip, mod.Legend, mod.Filler,
    )
    return mod
  })
  return loader
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function config(): ChartConfiguration {
  const muted = token('--c-muted')
  const grid = token('--c-border')
  const surface = token('--c-surface')
  const isDoughnut = props.kind === 'doughnut'
  const multi = props.series.length > 1
  // Only the value axis gets a money formatter. Passing `callback: undefined`
  // to the category axis would replace Chart.js's default and print indexes.
  const money = { callback: (value: string | number) => props.format(Number(value)) }

  return {
    type: props.kind,
    data: {
      labels: props.labels,
      datasets: props.series.map((s) => ({
        label: s.label,
        data: s.data,
        backgroundColor: s.color,
        borderColor: isDoughnut ? surface : s.color,
        borderWidth: isDoughnut ? 2 : props.kind === 'line' ? 2 : 0,
        borderDash: s.dashed ? [5, 4] : [],
        borderRadius: props.kind === 'bar' ? 6 : 0,
        pointRadius: props.kind === 'line' ? (props.labels.length > 20 ? 0 : 3) : 0,
        tension: 0.3,
        cubicInterpolationMode: 'monotone',
      })),
    } as ChartConfiguration['data'],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      indexAxis: props.horizontal ? 'y' : 'x',
      cutout: isDoughnut ? '62%' : undefined,
      plugins: {
        legend: {
          display: multi,
          position: 'bottom',
          labels: { color: muted, boxWidth: 12, boxHeight: 12, useBorderRadius: true, borderRadius: 3 },
        },
        tooltip: {
          callbacks: {
            label: (item) => {
              const value = typeof item.raw === 'number' ? item.raw : 0
              return `${multi || isDoughnut ? `${isDoughnut ? item.label : item.dataset.label}: ` : ''}${props.format(value)}`
            },
          },
        },
      },
      scales: isDoughnut
        ? {}
        : {
            x: {
              grid: { display: props.horizontal === true, color: grid },
              border: { display: false },
              ticks: {
                color: muted,
                maxRotation: 0,
                autoSkipPadding: 8,
                ...(props.horizontal ? { maxTicksLimit: 4, ...money } : {}),
              },
            },
            y: {
              beginAtZero: true,
              grid: { display: props.horizontal !== true, color: grid },
              border: { display: false },
              ticks: {
                color: muted,
                ...(props.horizontal ? {} : { maxTicksLimit: 5, ...money }),
              },
            },
          },
    } as ChartConfiguration['options'],
  }
}

async function render(): Promise<void> {
  if (!canvas.value) return
  try {
    const { Chart } = await loadChartJs()
    if (!canvas.value) return
    chart.value?.destroy()
    chart.value = new Chart(canvas.value, config())
  } catch {
    failed.value = true
  }
}

onMounted(render)
// Kind, data and theme changes are rare and cheap to redraw, so rebuild
// rather than patch the live chart's config.
watch(() => [props.kind, props.labels, props.series, props.horizontal, theme.value], render, { deep: true })
onBeforeUnmount(() => chart.value?.destroy())
</script>

<template>
  <div class="relative" :style="{ height: `${height ?? 220}px` }">
    <canvas v-show="!failed" ref="canvas" role="img" :aria-label="series.map((s) => s.label).join(', ')" />
    <p v-if="failed" class="grid h-full place-items-center text-xs text-faint">{{ $t('stats.chartFailed') }}</p>
  </div>
</template>
