<script setup lang="ts">
import itineraryDeparture from '@/assets/mascot/stickers/itinerary-departure.webp'
import itineraryMap from '@/assets/mascot/stickers/itinerary-map.webp'
import itineraryWaypoint from '@/assets/mascot/stickers/itinerary-waypoint.webp'
import ledgerEntry from '@/assets/mascot/stickers/ledger-entry.webp'
import ledgerSettled from '@/assets/mascot/stickers/ledger-settled.webp'
import ledgerSplit from '@/assets/mascot/stickers/ledger-split.webp'
import photosAlbum from '@/assets/mascot/stickers/photos-album.webp'
import photosCamera from '@/assets/mascot/stickers/photos-camera.webp'
import statsBars from '@/assets/mascot/stickers/stats-bars.webp'
import statsPie from '@/assets/mascot/stickers/stats-pie.webp'
import toolsChecklist from '@/assets/mascot/stickers/tools-checklist.webp'
import toolsPacking from '@/assets/mascot/stickers/tools-packing.webp'

const stickers = {
  'itinerary-departure': itineraryDeparture,
  'itinerary-map': itineraryMap,
  'itinerary-waypoint': itineraryWaypoint,
  'ledger-entry': ledgerEntry,
  'ledger-settled': ledgerSettled,
  'ledger-split': ledgerSplit,
  'photos-album': photosAlbum,
  'photos-camera': photosCamera,
  'stats-bars': statsBars,
  'stats-pie': statsPie,
  'tools-checklist': toolsChecklist,
  'tools-packing': toolsPacking,
} as const

withDefaults(defineProps<{ pose: keyof typeof stickers; size?: number }>(), { size: 72 })
</script>

<template>
  <img :src="stickers[pose]" alt="" class="tiger-mascot" :width="size" :height="size" decoding="async" />
</template>
