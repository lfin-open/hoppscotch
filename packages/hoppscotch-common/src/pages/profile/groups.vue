<template>
  <div class="grid grid-cols-1">
    <section class="p-4">
      <h4 class="font-semibold text-secondaryDark">
        {{ t("profile.my_groups") }}
      </h4>
      <div class="my-1 text-secondaryLight">
        {{ t("profile.my_groups_description") }}
      </div>

      <!-- Loading State -->
      <div
        v-if="loading"
        class="flex flex-1 flex-col items-center justify-center p-4"
      >
        <HoppSmartSpinner class="mb-4" />
      </div>

      <!-- Empty State -->
      <HoppSmartPlaceholder
        v-else-if="!myGroups || myGroups.length === 0"
        :src="`/images/states/${colorMode.value}/add_group.svg`"
        :alt="t('empty.groups')"
        :text="t('empty.groups')"
      >
        <template #body>
          <span class="text-secondaryLight">
            {{ t("profile.no_groups_description") }}
          </span>
        </template>
      </HoppSmartPlaceholder>

      <!-- Groups List with Expandable Cards -->
      <div v-else class="space-y-4 py-4">
        <div
          v-for="group in myGroups"
          :key="group.id"
          class="rounded border border-dividerLight transition hover:border-divider"
        >
          <!-- Group Header (Always Visible) -->
          <div
            class="flex cursor-pointer items-center justify-between p-4"
            @click="toggleGroup(group.id)"
          >
            <div class="flex flex-1 flex-col">
              <div class="flex items-center gap-2">
                <icon-lucide-users class="svg-icons" />
                <span class="font-semibold">{{ group.name }}</span>
                <span
                  class="rounded px-2 py-0.5 text-xs font-medium"
                  :class="{
                    'bg-green-500 bg-opacity-15 text-green-500':
                      group.role === 'OWNER',
                    'bg-yellow-500 bg-opacity-15 text-yellow-500':
                      group.role === 'EDITOR',
                    'bg-blue-500 bg-opacity-15 text-blue-500':
                      group.role === 'VIEWER',
                  }"
                >
                  {{ t(`team.roles.${group.role.toLowerCase()}`) }}
                </span>
              </div>
              <p
                v-if="group.description"
                class="mt-1 text-sm text-secondaryLight"
              >
                {{ group.description }}
              </p>
            </div>
            <icon-lucide-chevron-down
              class="svg-icons transition"
              :class="{ 'rotate-180': expandedGroups.has(group.id) }"
            />
          </div>

          <!-- Expandable Content: Accessible Teams -->
          <div
            v-if="expandedGroups.has(group.id)"
            class="border-t border-dividerLight bg-primaryLight px-4 py-3"
          >
            <h6
              class="mb-2 text-xs font-semibold uppercase text-secondaryLight"
            >
              {{ t("profile.accessible_teams") }}
            </h6>

            <!-- Loading teams for this group -->
            <div
              v-if="loadingGroupTeams.has(group.id)"
              class="flex items-center justify-center p-4"
            >
              <HoppSmartSpinner class="h-4 w-4" />
            </div>

            <!-- Teams list -->
            <div
              v-else-if="
                groupTeamsMap.get(group.id) &&
                groupTeamsMap.get(group.id)!.length > 0
              "
              class="space-y-2"
            >
              <div
                v-for="team in groupTeamsMap.get(group.id)"
                :key="team.id"
                class="flex items-center gap-2 rounded bg-primary p-2 text-sm"
              >
                <icon-lucide-folder class="svg-icons" />
                <span>{{ team.name }}</span>
              </div>
            </div>

            <!-- No teams -->
            <div v-else class="py-2 text-sm text-secondaryLight">
              {{ t("profile.no_accessible_teams") }}
            </div>
          </div>
        </div>
      </div>

      <!-- Team Access via Groups -->
      <div v-if="myGroups && myGroups.length > 0" class="mt-8">
        <h5 class="font-semibold text-secondaryDark">
          {{ t("profile.team_access_via_groups") }}
        </h5>
        <div class="my-1 text-secondaryLight">
          {{ t("profile.team_access_via_groups_description") }}
        </div>

        <!-- Loading team access -->
        <div
          v-if="loadingTeamAccess"
          class="flex flex-1 flex-col items-center justify-center p-4"
        >
          <HoppSmartSpinner class="mb-4" />
        </div>

        <!-- Team access list -->
        <div v-else-if="teamAccessList.length > 0" class="space-y-2 py-4">
          <div
            v-for="access in teamAccessList"
            :key="`${access.groupId}-${access.teamId}`"
            class="flex items-center justify-between rounded border border-dividerLight p-3 text-sm"
          >
            <div class="flex items-center gap-2">
              <icon-lucide-folder class="svg-icons" />
              <span>{{ access.teamName }}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-secondaryLight">
              <icon-lucide-arrow-left class="svg-icons" />
              <span>{{ access.groupName }}</span>
            </div>
          </div>
        </div>

        <!-- No team access -->
        <div v-else class="py-4 text-sm text-secondaryLight">
          {{ t("profile.no_team_access_via_groups") }}
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue"
import { useI18n } from "@composables/i18n"
import { useColorMode } from "@composables/theming"
import * as E from "fp-ts/Either"
import IconLucideChevronDown from "~icons/lucide/chevron-down"
import IconLucideFolder from "~icons/lucide/folder"

import { runGQLQuery } from "~/helpers/backend/GQLClient"
import {
  MyUserGroupsDocument,
  UserGroupTeamAccessDocument,
  UserGroupDocument,
} from "~/helpers/backend/graphql"

const t = useI18n()
const colorMode = useColorMode()

// User groups state
const loading = ref(false)
const myGroups = ref<
  Array<{
    id: string
    name: string
    description: string | null
    role: string
  }>
>([])

// Expandable groups state
const expandedGroups = ref<Set<string>>(new Set())
const loadingGroupTeams = ref<Set<string>>(new Set())
const groupTeamsMap = ref<
  Map<
    string,
    Array<{
      id: string
      name: string
    }>
  >
>(new Map())

// Toggle group expansion
const toggleGroup = async (groupId: string) => {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)

    // Fetch accessible teams if not already loaded
    if (!groupTeamsMap.value.has(groupId)) {
      await fetchAccessibleTeamsForGroup(groupId)
    }
  }
}

// Fetch accessible teams for a specific group
const fetchAccessibleTeamsForGroup = async (groupId: string) => {
  loadingGroupTeams.value.add(groupId)

  try {
    const result = await runGQLQuery({
      query: UserGroupDocument,
      variables: { id: groupId },
    })

    if (E.isRight(result) && result.right.userGroup) {
      const group = result.right.userGroup
      const teams = group.accessibleTeams || []
      groupTeamsMap.value.set(groupId, teams)
    } else {
      groupTeamsMap.value.set(groupId, [])
    }
  } catch (error) {
    console.error("Error fetching accessible teams:", error)
    groupTeamsMap.value.set(groupId, [])
  } finally {
    loadingGroupTeams.value.delete(groupId)
  }
}

// Fetch team access for each group
const loadingTeamAccess = ref(false)
const teamAccessList = ref<
  Array<{
    groupId: string
    groupName: string
    teamId: string
    teamName: string
  }>
>([])

// Fetch user groups
const fetchMyGroups = async () => {
  loading.value = true

  try {
    const result = await runGQLQuery({
      query: MyUserGroupsDocument,
      variables: {},
    })

    if (E.isLeft(result)) {
      console.error("Failed to fetch user groups:", result.left)
      myGroups.value = []
    } else {
      myGroups.value = result.right.myUserGroups || []

      // After fetching groups, fetch team access for each group
      if (myGroups.value.length > 0) {
        await fetchTeamAccessForGroups()
      }
    }
  } catch (error) {
    console.error("Error fetching user groups:", error)
    myGroups.value = []
  } finally {
    loading.value = false
  }
}

// Fetch team access for all groups
const fetchTeamAccessForGroups = async () => {
  loadingTeamAccess.value = true
  const allTeamAccess: Array<{
    groupId: string
    groupName: string
    teamId: string
    teamName: string
  }> = []

  try {
    // Fetch team access for each group in parallel
    const promises = myGroups.value.map(async (group) => {
      const result = await runGQLQuery({
        query: UserGroupTeamAccessDocument,
        variables: { groupId: group.id },
      })

      if (E.isRight(result)) {
        const accessList = result.right.userGroupTeamAccess || []
        return accessList.map((access) => ({
          groupId: group.id,
          groupName: group.name,
          teamId: access.teamId,
          teamName: access.team.name,
        }))
      }
      return []
    })

    const results = await Promise.all(promises)
    results.forEach((teamAccessArray) => {
      allTeamAccess.push(...teamAccessArray)
    })

    teamAccessList.value = allTeamAccess
  } catch (error) {
    console.error("Error fetching team access:", error)
    teamAccessList.value = []
  } finally {
    loadingTeamAccess.value = false
  }
}

onMounted(() => {
  fetchMyGroups()
})
</script>
