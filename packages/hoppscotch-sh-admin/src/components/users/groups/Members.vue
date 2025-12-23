<template>
  <div class="flex flex-col space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">{{ t('user_groups.members') }}</h3>
      <HoppButtonPrimary
        :label="t('user_groups.add_members')"
        :icon="IconUserPlus"
        @click="showAddMembersModal = true"
      />
    </div>

    <HoppSmartTable
      v-model:list="membersList"
      :headings="headings"
      :loading="fetching"
    >
      <template #head>
        <th class="px-6 py-2">{{ t('user_groups.member_name') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.email') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.is_admin') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.added_at') }}</th>
        <th class="w-20 px-6 py-2"></th>
      </template>

      <template #empty-state>
        <td colspan="5">
          <span class="flex justify-center p-3">
            {{
              error
                ? t('user_groups.load_members_error')
                : t('user_groups.no_members')
            }}
          </span>
        </td>
      </template>

      <template #body="{ row: member }">
        <td class="py-2 px-7">
          {{ member.user.displayName || t('users.unnamed') }}
        </td>

        <td class="py-2 px-7">{{ member.user.email }}</td>

        <td class="py-2 px-7">
          <span
            v-if="member.isAdmin"
            class="text-xs font-medium px-3 py-0.5 rounded-full bg-green-900 text-green-300"
          >
            {{ t('user_groups.admin') }}
          </span>
          <span v-else class="text-secondaryLight">
            {{ t('user_groups.member') }}
          </span>
        </td>

        <td class="py-2 px-7">
          {{ formatDate(member.addedAt) }}
        </td>

        <td @click.stop class="flex justify-end w-20">
          <div class=" mr-5">
            <tippy interactive trigger="click" theme="popover">
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :icon="IconMoreHorizontal"
              />
              <template #content="{ hide }">
                <div class="flex flex-col focus:outline-none" tabindex="0">
                  <HoppSmartItem
                    :icon="IconTrash"
                    :label="t('user_groups.remove_member')"
                    class="!hover:bg-red-600"
                    @click="
                      () => {
                        confirmMemberRemoval(member.user.uid);
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

    <!-- Modals -->
    <UserGroupsAddMembersModal
      v-if="showAddMembersModal"
      :group-id="groupId"
      @hide-modal="showAddMembersModal = false"
      @members-added="onMembersAdded"
    />

    <HoppSmartConfirmModal
      :show="confirmRemoval"
      :title="t('user_groups.confirm_remove_member')"
      @hide-modal="resetConfirmRemoval"
      @resolve="removeMember(removeMemberUid)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery, useMutation } from '@urql/vue';
import { format } from 'date-fns';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import {
  GetUserGroupMembersDocument,
  RemoveUserFromGroupDocument,
} from '~/helpers/backend/graphql';
import UserGroupsAddMembersModal from './AddMembersModal.vue';
import IconUserPlus from '~icons/lucide/user-plus';
import IconMoreHorizontal from '~icons/lucide/more-horizontal';
import IconTrash from '~icons/lucide/trash';

const t = useI18n();
const toast = useToast();

const props = defineProps<{
  groupId: string;
}>();

// Format helper
const formatDate = (date: string) => {
  return format(new Date(date), 'dd MMM yyyy');
};

// Table headings
const headings = [
  { key: 'user.displayName', label: t('user_groups.member_name') },
  { key: 'user.email', label: t('user_groups.email') },
  { key: 'isAdmin', label: t('user_groups.is_admin') },
  { key: 'addedAt', label: t('user_groups.added_at') },
  { key: '', label: '' },
];

// Fetch members
const { data, fetching, error, executeQuery } = useQuery({
  query: GetUserGroupMembersDocument,
  variables: { groupId: props.groupId, limit: 100, offset: 0 },
});

const membersList = computed(() => data.value?.userGroupMembers || []);

// Add members modal
const showAddMembersModal = ref(false);

const onMembersAdded = async () => {
  showAddMembersModal.value = false;
  await executeQuery();
  toast.success(t('user_groups.members_added_success'));
};

// Remove member
const confirmRemoval = ref(false);
const removeMemberUid = ref<string | null>(null);
const memberRemoval = useMutation(RemoveUserFromGroupDocument);

const confirmMemberRemoval = (uid: string) => {
  confirmRemoval.value = true;
  removeMemberUid.value = uid;
};

const resetConfirmRemoval = () => {
  confirmRemoval.value = false;
  removeMemberUid.value = null;
};

const removeMember = async (uid: string | null) => {
  if (!uid) return;

  const result = await memberRemoval.executeMutation({
    groupId: props.groupId,
    userUid: uid,
  });

  if (result.error) {
    toast.error(t('user_groups.remove_member_failure'));
  } else {
    toast.success(t('user_groups.remove_member_success'));
    await executeQuery();
  }

  confirmRemoval.value = false;
  removeMemberUid.value = null;
};
</script>
