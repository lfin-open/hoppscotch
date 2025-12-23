<template>
  <div class="flex flex-col">
    <!-- Header -->
    <div class="flex flex-col">
      <h1 class="text-lg font-bold text-secondaryDark">
        {{ t('user_groups.title') }}
      </h1>
      <div class="flex items-center space-x-4 mt-10 mb-5">
        <HoppButtonPrimary
          :label="t('user_groups.create_group')"
          @click="showCreateGroupModal = true"
          :icon="IconPlus"
        />
      </div>

      <!-- Table -->
      <div class="overflow-x-auto mb-5">
        <!-- Pagination Controls -->
        <div class="mb-3 flex items-center justify-end">
          <HoppButtonSecondary
            outline
            filled
            :icon="IconLeft"
            :disabled="page === 1"
            @click="changePage(PageDirection.Previous)"
          />

          <div class="flex h-full w-10 items-center justify-center">
            <span>{{ page }}</span>
          </div>

          <HoppButtonSecondary
            outline
            filled
            :icon="IconRight"
            :disabled="page >= totalPages"
            @click="changePage(PageDirection.Next)"
          />
        </div>

        <HoppSmartTable
          v-model:list="finalGroupsList"
          :headings="headings"
          :loading="showSpinner"
          @onRowClicked="goToGroupDetails"
        >
          <template #extension>
            <div class="flex w-full items-center bg-primary">
              <icon-lucide-search class="mx-3 text-xs" />
              <HoppSmartInput
                v-model="query"
                styles="w-full bg-primary py-1"
                input-styles="h-full border-none"
                :placeholder="t('user_groups.search_placeholder')"
              />
            </div>
          </template>

          <template #head>
            <th class="px-6 py-2">{{ t('user_groups.name') }}</th>
            <th class="px-6 py-2">{{ t('user_groups.description') }}</th>
            <th class="px-6 py-2">{{ t('user_groups.role') }}</th>
            <th class="px-6 py-2">{{ t('user_groups.members') }}</th>
            <th class="px-6 py-2">{{ t('user_groups.teams') }}</th>
            <th class="px-6 py-2">{{ t('user_groups.created_at') }}</th>
            <th class="w-20 px-6 py-2"></th>
          </template>

          <template #empty-state>
            <td colspan="7">
              <span class="flex justify-center p-3">
                {{
                  error
                    ? t('user_groups.load_list_error')
                    : t('user_groups.no_groups')
                }}
              </span>
            </td>
          </template>

          <template #body="{ row: group }">
            <td class="py-2 px-7">
              <span class="font-medium">{{ group.name }}</span>
            </td>

            <td class="py-2 px-7 truncate max-w-xs">
              {{ group.description || t('state.none') }}
            </td>

            <td class="py-2 px-7">
              <span
                class="text-xs font-medium px-3 py-0.5 rounded-full"
                :class="getRoleBadgeClass(group.role)"
              >
                {{ getRoleLabel(group.role) }}
              </span>
            </td>

            <td class="py-2 px-7">{{ group.memberCount || 0 }}</td>

            <td class="py-2 px-7">{{ group.teamCount || 0 }}</td>

            <td class="py-2 px-7">
              {{ getCreatedDate(group.createdAt) }}
              <div class="text-gray-400 text-tiny">
                {{ getCreatedTime(group.createdAt) }}
              </div>
            </td>

            <td @click.stop class="flex justify-end w-20">
              <div class="mt-2 mr-5">
                <tippy
                  :key="group.id"
                  interactive
                  trigger="click"
                  theme="popover"
                >
                  <HoppButtonSecondary
                    v-tippy="{ theme: 'tooltip' }"
                    :icon="IconMoreHorizontal"
                  />
                  <template #content="{ hide }">
                    <div
                      class="flex flex-col focus:outline-none"
                      tabindex="0"
                      @keyup.escape="hide()"
                    >
                      <HoppSmartItem
                        :icon="IconEdit"
                        :label="t('user_groups.edit_group')"
                        @click="
                          () => {
                            editGroup(group);
                            hide();
                          }
                        "
                      />
                      <HoppSmartItem
                        :icon="IconTrash"
                        :label="t('user_groups.delete_group')"
                        class="!hover:bg-red-600"
                        @click="
                          () => {
                            confirmGroupDeletion(group.id);
                            hide();
                          }
                        "
                      />
                    </div>
                  </template>
                </tippy>
              </div>
            </td>
          </template>
        </HoppSmartTable>
      </div>
    </div>

    <!-- Modals -->
    <UserGroupsCreateModal
      v-if="showCreateGroupModal"
      @hide-modal="showCreateGroupModal = false"
      @group-created="onGroupCreated"
    />
    <UserGroupsEditModal
      v-if="showEditGroupModal && selectedGroup"
      :group="selectedGroup"
      @hide-modal="showEditGroupModal = false"
      @group-updated="onGroupUpdated"
    />
    <HoppSmartConfirmModal
      :show="confirmDeleteGroup"
      :title="t('user_groups.confirm_delete_group')"
      @hide-modal="resetConfirmGroupDeletion"
      @resolve="deleteGroup(deleteGroupId)"
    />
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQuery } from '@urql/vue';
import { format } from 'date-fns';
import { computed, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import {
  DeleteUserGroupDocument,
  GetUserGroupsDocument,
  UserGroupTeamAccessRole,
} from '~/helpers/backend/graphql';
import IconLeft from '~icons/lucide/chevron-left';
import IconRight from '~icons/lucide/chevron-right';
import IconMoreHorizontal from '~icons/lucide/more-horizontal';
import IconPlus from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash';
import IconEdit from '~icons/lucide/pencil';
import UserGroupsCreateModal from '~/components/users/groups/CreateModal.vue';
import UserGroupsEditModal from '~/components/users/groups/EditModal.vue';

const t = useI18n();
const toast = useToast();
const router = useRouter();

// Time and Date Helpers
const getCreatedDate = (date: string) => format(new Date(date), 'yyyy-MM-dd');
const getCreatedTime = (date: string) => format(new Date(date), 'hh:mm a');

// Role Helpers
const getRoleLabel = (role: UserGroupTeamAccessRole) => {
  const labels = {
    [UserGroupTeamAccessRole.Owner]: t('user_groups.role_owner'),
    [UserGroupTeamAccessRole.Editor]: t('user_groups.role_editor'),
    [UserGroupTeamAccessRole.Viewer]: t('user_groups.role_viewer'),
  };
  return labels[role] || role;
};

const getRoleBadgeClass = (role: UserGroupTeamAccessRole) => {
  const classes = {
    [UserGroupTeamAccessRole.Owner]: 'bg-purple-900 text-purple-300',
    [UserGroupTeamAccessRole.Editor]: 'bg-blue-900 text-blue-300',
    [UserGroupTeamAccessRole.Viewer]: 'bg-gray-700 text-gray-300',
  };
  return classes[role] || 'bg-gray-700 text-gray-300';
};

// Table Headings
const headings = [
  { key: 'name', label: t('user_groups.name') },
  { key: 'description', label: t('user_groups.description') },
  { key: 'role', label: t('user_groups.role') },
  { key: 'memberCount', label: t('user_groups.members') },
  { key: 'teamCount', label: t('user_groups.teams') },
  { key: 'createdAt', label: t('user_groups.created_at') },
  { key: '', label: '' },
];

// Pagination
const groupsPerPage = 20;
const page = ref(1);

enum PageDirection {
  Previous,
  Next,
}

// Search
const query = ref('');
const searchQuery = ref('');

// Debounce
let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

onUnmounted(() => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
  }
});

const debounce = (func: () => void, delay: number) => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(func, delay);
};

// Fetch Groups with Pagination and Search
const { data, fetching, error, executeQuery } = useQuery({
  query: GetUserGroupsDocument,
  variables: computed(() => ({
    limit: groupsPerPage,
    offset: (page.value - 1) * groupsPerPage,
    search: searchQuery.value || undefined,
  })),
});

const groupsList = computed(() => data.value?.userGroups || []);
const totalGroups = computed(() => groupsList.value.length);

const totalPages = computed(() => {
  if (searchQuery.value) {
    return Math.ceil(totalGroups.value / groupsPerPage);
  }
  // For now, use a simple calculation - in production, you'd get total count from backend
  return Math.ceil(totalGroups.value / groupsPerPage) || 1;
});

const finalGroupsList = computed(() => groupsList.value);

// Spinner
const showSpinner = ref(false);

watch(fetching, (isFetching) => {
  if (isFetching) {
    showSpinner.value = true;
    debounce(() => {
      showSpinner.value = false;
    }, 500);
  }
});

// Search Handler
const handleSearch = async (input: string) => {
  searchQuery.value = input;
  page.value = 1;
  await executeQuery();
};

watch(query, () => {
  if (query.value.length === 0) {
    handleSearch(query.value);
  } else {
    debounce(() => {
      handleSearch(query.value);
    }, 500);
  }
});

// Pagination Handler
const changePage = (direction: PageDirection) => {
  const isPrevious = direction === PageDirection.Previous;
  const isValidPreviousAction = isPrevious && page.value > 1;
  const isValidNextAction = !isPrevious && page.value < totalPages.value;

  if (isValidNextAction || isValidPreviousAction) {
    page.value += isPrevious ? -1 : 1;
  }
};

watch(page, async () => {
  if (page.value < 1 || page.value > totalPages.value) {
    return;
  }
  await executeQuery();
});

// Navigation
const goToGroupDetails = (group: any) => {
  router.push(`/users/groups/${group.id}`);
};

// Create Group
const showCreateGroupModal = ref(false);

const onGroupCreated = async () => {
  showCreateGroupModal.value = false;
  await executeQuery();
  toast.success(t('user_groups.group_created_success'));
};

// Edit Group
const showEditGroupModal = ref(false);
const selectedGroup = ref<any>(null);

const editGroup = (group: any) => {
  selectedGroup.value = group;
  showEditGroupModal.value = true;
};

const onGroupUpdated = async () => {
  showEditGroupModal.value = false;
  selectedGroup.value = null;
  await executeQuery();
  toast.success(t('user_groups.group_updated_success'));
};

// Delete Group
const confirmDeleteGroup = ref(false);
const deleteGroupId = ref<string | null>(null);
const groupDeletion = useMutation(DeleteUserGroupDocument);

const confirmGroupDeletion = (id: string) => {
  confirmDeleteGroup.value = true;
  deleteGroupId.value = id;
};

const resetConfirmGroupDeletion = () => {
  confirmDeleteGroup.value = false;
  deleteGroupId.value = null;
};

const deleteGroup = async (id: string | null) => {
  if (!id) return;

  const result = await groupDeletion.executeMutation({ groupId: id });

  if (result.error) {
    toast.error(t('user_groups.delete_group_failure'));
  } else {
    toast.success(t('user_groups.delete_group_success'));
    await executeQuery();
  }

  confirmDeleteGroup.value = false;
  deleteGroupId.value = null;
};
</script>
