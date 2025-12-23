<template>
  <div ref="inputContainer" class="relative w-full">
    <!-- Search Input -->
    <div class="relative">
      <HoppSmartInput
        :label="label"
        input-styles="floating-input"
        :placeholder="placeholder"
        :modelValue="displayValue"
        @update:modelValue="handleInput"
        @focus="handleFocus"
        @click="handleClick"
      />
      <icon-lucide-search
        v-if="!selectedTeam"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-secondaryLight text-sm"
      />
      <button
        v-else
        type="button"
        class="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-divider rounded transition"
        @click="clearSelection"
      >
        <icon-lucide-x class="text-sm" />
      </button>
    </div>

    <!-- Dropdown with Team List (Teleported as Overlay) -->
    <Teleport to="body">
      <div
        v-if="showDropdown && filteredTeams.length > 0"
        ref="dropdown"
        :style="dropdownStyle"
        class="fixed z-[9999] bg-primary border border-divider rounded-lg shadow-lg max-h-64 overflow-y-auto"
      >
      <div
        v-for="(team, index) in filteredTeams"
        :key="team.id"
        :class="[
          'flex items-center space-x-3 px-4 py-3 cursor-pointer transition',
          index === highlightedIndex
            ? 'bg-primaryDark'
            : 'hover:bg-primaryLight',
        ]"
        @click="selectTeam(team)"
        @mouseenter="highlightedIndex = index"
      >
        <!-- Team Icon -->
        <div
          class="w-10 h-10 rounded-lg bg-accentDark flex items-center justify-center flex-shrink-0"
        >
          <icon-lucide-users class="text-accentContrast text-lg" />
        </div>

        <!-- Team Info -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium truncate">
            {{ team.name }}
          </div>
          <div class="text-xs text-secondaryLight">
            {{ getMemberCount(team) }}
          </div>
        </div>
      </div>
      </div>
    </Teleport>

    <!-- No Results Message (Teleported as Overlay) -->
    <Teleport to="body">
      <div
        v-if="showDropdown && internalSearchQuery && filteredTeams.length === 0"
        :style="dropdownStyle"
        class="fixed z-[9999] bg-primary border border-divider rounded-lg shadow-lg p-4 text-center text-secondaryLight text-sm"
      >
      {{ t('user_groups.no_teams_found') }}
      </div>
    </Teleport>

    <!-- Loading State (Teleported as Overlay) -->
    <Teleport to="body">
      <div
        v-if="loading"
        :style="dropdownStyle"
        class="fixed z-[9999] bg-primary border border-divider rounded-lg shadow-lg p-4 flex justify-center"
      >
      <HoppSmartSpinner />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useQuery } from '@urql/vue';
import { useI18n } from '~/composables/i18n';
import { TeamListDocument } from '~/helpers/backend/graphql';
import IconSearch from '~icons/lucide/search';
import IconUsers from '~icons/lucide/users';
import IconX from '~icons/lucide/x';

const t = useI18n();

// Props
const props = defineProps<{
  modelValue?: string | null; // Selected team ID
  label?: string;
  placeholder?: string;
  excludeTeamIds?: string[]; // Teams to exclude from list
}>();

// Emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void;
  (event: 'team-selected', team: TeamInfo): void;
}>();

// Team type from GraphQL
interface TeamInfo {
  id: string;
  name: string;
  teamMembers: Array<{
    membershipID: string;
  }>;
}

// State
const internalSearchQuery = ref('');
const showDropdown = ref(false);
const highlightedIndex = ref(0);
const dropdown = ref<HTMLElement | null>(null);
const inputContainer = ref<HTMLElement | null>(null);

// Display value: show selected team name or search query
const displayValue = computed(() => {
  if (selectedTeam.value) {
    return selectedTeam.value.name;
  }
  return internalSearchQuery.value;
});

// Dropdown position (for Teleport overlay)
const dropdownStyle = computed(() => {
  if (!inputContainer.value) return {};

  const rect = inputContainer.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 8}px`, // 8px gap below input
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  };
});

// Query teams (load all for client-side filtering)
const { data, fetching: loading } = useQuery({
  query: TeamListDocument,
  variables: { cursor: undefined, take: 1000 }, // Load all teams
});

const allTeams = computed<TeamInfo[]>(() => {
  const teams = data.value?.infra?.allTeams;
  if (!teams) return [];

  // Keep loading until we have all teams
  const teamList: TeamInfo[] = [];
  let current = teams;

  while (current) {
    teamList.push(...(current as any));
    current = null; // We'll handle pagination if needed
  }

  return teamList;
});

// Selected team
const selectedTeam = computed(() => {
  if (!props.modelValue) return null;
  return allTeams.value.find((team) => team.id === props.modelValue) || null;
});

// Filter teams based on search query
const filteredTeams = computed(() => {
  const query = internalSearchQuery.value.toLowerCase().trim();

  let teams = allTeams.value;

  // Exclude specified team IDs
  if (props.excludeTeamIds && props.excludeTeamIds.length > 0) {
    teams = teams.filter((team) => !props.excludeTeamIds!.includes(team.id));
  }

  // If no query, return all teams (up to 50 for performance)
  if (!query) {
    return teams.slice(0, 50);
  }

  // Filter by team name
  return teams
    .filter((team) => {
      const teamName = team.name.toLowerCase();
      return teamName.includes(query);
    })
    .slice(0, 50); // Limit results
});

// Handle input changes
const handleInput = (value: string) => {
  internalSearchQuery.value = value;

  // If user is typing and there's a selection, clear it
  if (selectedTeam.value) {
    emit('update:modelValue', null);
  }

  showDropdown.value = true;
  highlightedIndex.value = 0;
};

// Handle focus
const handleFocus = () => {
  // If there's a selected team, clear internal query to show all teams
  if (selectedTeam.value) {
    internalSearchQuery.value = '';
  }

  // Always show dropdown on focus
  showDropdown.value = true;
  highlightedIndex.value = 0;
};

// Handle click - ensure dropdown opens on click
const handleClick = () => {
  // If there's a selected team, clear internal query to show all teams
  if (selectedTeam.value) {
    internalSearchQuery.value = '';
  }

  // Force dropdown to show
  showDropdown.value = true;
  highlightedIndex.value = 0;
};

// Select team
const selectTeam = (team: TeamInfo) => {
  emit('update:modelValue', team.id);
  emit('team-selected', team);
  internalSearchQuery.value = ''; // Clear search query
  showDropdown.value = false;
};

// Clear selection
const clearSelection = () => {
  emit('update:modelValue', null);
  internalSearchQuery.value = '';
  showDropdown.value = true;
};

// Get member count text
const getMemberCount = (team: TeamInfo): string => {
  const count = team.teamMembers?.length || 0;
  return count === 1
    ? t('user_groups.one_member')
    : t('user_groups.members_count', { count });
};

// Keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  if (!showDropdown.value || filteredTeams.value.length === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        filteredTeams.value.length - 1
      );
      break;
    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      event.preventDefault();
      if (filteredTeams.value[highlightedIndex.value]) {
        selectTeam(filteredTeams.value[highlightedIndex.value]);
      }
      break;
    case 'Escape':
      event.preventDefault();
      showDropdown.value = false;
      break;
  }
};

// Click outside handler (updated for Teleport)
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;

  // Check if click is outside both input container and dropdown
  const clickedInsideInput = inputContainer.value?.contains(target);
  const clickedInsideDropdown = dropdown.value?.contains(target);

  if (!clickedInsideInput && !clickedInsideDropdown) {
    showDropdown.value = false;
  }
};

// Update dropdown position on scroll/resize
const updateDropdownPosition = () => {
  // Force re-computation of dropdownStyle
  if (showDropdown.value && inputContainer.value) {
    // Trigger reactivity by accessing the computed property
    dropdownStyle.value;
  }
};

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('scroll', updateDropdownPosition, true);
  window.addEventListener('resize', updateDropdownPosition);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('scroll', updateDropdownPosition, true);
  window.removeEventListener('resize', updateDropdownPosition);
});

// Watch for external modelValue changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (!newValue) {
      internalSearchQuery.value = '';
    }
  }
);
</script>
