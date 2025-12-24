<template>
  <div class="inline-flex items-center gap-1">
    <!-- Access Type Icon -->
    <icon-lucide-user
      v-if="accessInfo?.type === 'DIRECT'"
      v-tippy="{ theme: 'tooltip' }"
      :title="t('team.access_direct')"
      class="svg-icons text-accent"
    />
    <icon-lucide-users
      v-else-if="accessInfo?.type === 'GROUP'"
      v-tippy="{ theme: 'tooltip' }"
      :title="groupAccessTooltip"
      class="svg-icons text-accent"
    />
    <icon-lucide-zap
      v-else-if="accessInfo?.type === 'BOTH'"
      v-tippy="{ theme: 'tooltip' }"
      :title="t('team.access_both')"
      class="svg-icons text-accent"
    />

    <!-- Role Badge (optional) -->
    <span
      v-if="showRole && accessInfo?.effectiveRole"
      class="rounded bg-primaryLight px-2 py-0.5 text-tiny font-medium text-secondaryDark"
    >
      {{ roleLabel }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@composables/i18n"
import IconLucideUser from "~icons/lucide/user"
import IconLucideUsers from "~icons/lucide/users"
import IconLucideZap from "~icons/lucide/zap"
import type { TeamAccessInfo } from "~/helpers/backend/graphql"

const t = useI18n()

const props = withDefaults(
  defineProps<{
    accessInfo: TeamAccessInfo | null | undefined
    showRole?: boolean
  }>(),
  {
    showRole: false,
  }
)

const groupAccessTooltip = computed(() => {
  if (
    props.accessInfo?.type === "GROUP" &&
    props.accessInfo.groupAccess.length > 0
  ) {
    const groupNames = props.accessInfo.groupAccess
      .map((g) => g.groupName)
      .join(", ")
    return t("team.access_via_group", { groupName: groupNames })
  }
  return ""
})

const roleLabel = computed(() => {
  if (!props.accessInfo?.effectiveRole) return ""

  const role = props.accessInfo.effectiveRole

  // If BOTH access type, show it's the highest role
  if (props.accessInfo.type === "BOTH") {
    return t("team.access_highest", { role })
  }

  return role
})
</script>
