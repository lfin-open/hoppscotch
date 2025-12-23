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
        v-if="!selectedUser"
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

    <!-- Dropdown with User List (Teleported as Overlay) -->
    <Teleport to="body">
      <div
        v-if="showDropdown && filteredUsers.length > 0"
        ref="dropdown"
        :style="dropdownStyle"
        class="fixed z-[9999] bg-primary border border-divider rounded-lg shadow-lg max-h-64 overflow-y-auto"
      >
      <div
        v-for="(user, index) in filteredUsers"
        :key="user.uid"
        :class="[
          'flex items-center space-x-3 px-3 py-2 cursor-pointer transition',
          index === highlightedIndex
            ? 'bg-primaryDark'
            : 'hover:bg-primaryLight',
        ]"
        @click="selectUser(user)"
        @mouseenter="highlightedIndex = index"
      >
        <!-- Avatar -->
        <img
          v-if="user.photoURL"
          :src="user.photoURL"
          :alt="user.displayName || 'User'"
          class="w-6 h-6 rounded-full flex-shrink-0"
        />
        <div
          v-else
          class="w-6 h-6 rounded-full bg-accentDark flex items-center justify-center text-sm font-medium text-accentContrast flex-shrink-0"
        >
          {{ getInitials(user.displayName || user.email) }}
        </div>

        <!-- User Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center space-x-2">
            <span class="text-sm font-medium truncate">
              {{ user.displayName || t('users.unnamed') }}
            </span>
          </div>
          <span class="text-xs text-secondaryLight truncate">
            {{ user.email }}
          </span>
        </div>
      </div>
      </div>
    </Teleport>

    <!-- No Results Message (Teleported as Overlay) -->
    <Teleport to="body">
      <div
        v-if="showDropdown && internalSearchQuery && filteredUsers.length === 0"
        :style="dropdownStyle"
        class="fixed z-[9999] bg-primary border border-divider rounded-lg shadow-lg p-4 text-center text-secondaryLight text-sm"
      >
      {{ t('user_groups.no_users_found') }}
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
import { UsersListV2Document } from '~/helpers/backend/graphql';
import IconSearch from '~icons/lucide/search';
import IconX from '~icons/lucide/x';

const t = useI18n();

// Props
const props = defineProps<{
  modelValue?: string | null; // Selected user UID
  label?: string;
  placeholder?: string;
  excludeUserIds?: string[]; // Users to exclude from list
}>();

// Emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: string | null): void;
  (event: 'user-selected', user: UserInfo): void;
}>();

// User type from GraphQL
interface UserInfo {
  uid: string;
  displayName: string | null;
  email: string;
  photoURL: string | null;
  isAdmin: boolean;
}

// State
const internalSearchQuery = ref('');
const showDropdown = ref(false);
const highlightedIndex = ref(0);
const dropdown = ref<HTMLElement | null>(null);
const inputContainer = ref<HTMLElement | null>(null);

// Display value: show selected user email or search query
const displayValue = computed(() => {
  if (selectedUser.value) {
    return selectedUser.value.email;
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

// Query users
const { data, fetching: loading } = useQuery({
  query: UsersListV2Document,
  variables: { searchString: '', take: 1000, skip: 0 }, // Load all users for client-side filtering
});

const allUsers = computed<UserInfo[]>(
  () => (data.value?.infra?.allUsersV2 as UserInfo[]) || []
);

// Selected user
const selectedUser = computed(() => {
  if (!props.modelValue) return null;
  return allUsers.value.find((user) => user.uid === props.modelValue) || null;
});

// Filter users based on search query
const filteredUsers = computed(() => {
  const query = internalSearchQuery.value.toLowerCase().trim();

  let users = allUsers.value;

  // Exclude specified user IDs
  if (props.excludeUserIds && props.excludeUserIds.length > 0) {
    users = users.filter((user) => !props.excludeUserIds!.includes(user.uid));
  }

  // If no query, return all users (up to 50 for performance)
  if (!query) {
    return users.slice(0, 50);
  }

  // Filter by displayName or email
  return users
    .filter((user) => {
      const displayName = (user.displayName || '').toLowerCase();
      const email = user.email.toLowerCase();
      return displayName.includes(query) || email.includes(query);
    })
    .slice(0, 50); // Limit results
});

// Handle input changes
const handleInput = (value: string) => {
  internalSearchQuery.value = value;

  // If user is typing and there's a selection, clear it
  if (selectedUser.value) {
    emit('update:modelValue', null);
  }

  showDropdown.value = true;
  highlightedIndex.value = 0;
};

// Handle focus
const handleFocus = () => {
  // If there's a selected user, clear internal query to show all users
  if (selectedUser.value) {
    internalSearchQuery.value = '';
  }

  // Always show dropdown on focus
  showDropdown.value = true;
  highlightedIndex.value = 0;
};

// Handle click - ensure dropdown opens on click
const handleClick = () => {
  // If there's a selected user, clear internal query to show all users
  if (selectedUser.value) {
    internalSearchQuery.value = '';
  }

  // Force dropdown to show
  showDropdown.value = true;
  highlightedIndex.value = 0;
};

// Select user
const selectUser = (user: UserInfo) => {
  emit('update:modelValue', user.uid);
  emit('user-selected', user);
  internalSearchQuery.value = ''; // Clear search query
  showDropdown.value = false;
};

// Clear selection
const clearSelection = () => {
  emit('update:modelValue', null);
  internalSearchQuery.value = '';
  showDropdown.value = true;
};

// Get user initials for avatar
const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.split(/\s+|@/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

// Keyboard navigation
const handleKeydown = (event: KeyboardEvent) => {
  if (!showDropdown.value || filteredUsers.value.length === 0) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        filteredUsers.value.length - 1
      );
      break;
    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      event.preventDefault();
      if (filteredUsers.value[highlightedIndex.value]) {
        selectUser(filteredUsers.value[highlightedIndex.value]);
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
