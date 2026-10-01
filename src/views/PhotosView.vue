<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import PhotoAlbum from '@/components/photos/PhotoAlbum.vue'
const route = useRoute()
const { t } = useI18n()
</script>
<template><AppShell nav><TopBar :title="t('photos.mine')" back /><PhotoAlbum :local-group-id="typeof route.query.group === 'string' ? route.query.group : undefined" /></AppShell></template>
