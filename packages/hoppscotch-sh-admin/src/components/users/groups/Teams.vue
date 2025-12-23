<template>
  <div class="flex flex-col space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold">{{ t('user_groups.assigned_teams') }}</h3>
      <HoppButtonPrimary
        :label="t('user_groups.assign_teams')"
        :icon="IconPlus"
        @click="showAssignTeamsModal = true"
      />
    </div>

    <HoppSmartTable
      v-model:list="teamsList"
      :headings="headings"
      :loading="fetching"
    >
      <template #head>
        <th class="px-6 py-2">{{ t('user_groups.team_name') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.assigned_at') }}</th>
        <th class="w-20 px-6 py-2"></th>
      </template>

      <template #empty-state>
        <td colspan="3">
          <span class="flex justify-center p-3">
            {{
              error
                ? t('user_groups.load_teams_error')
                : t('user_groups.no_teams_assigned')
            }}
          </span>
        </td>
      </template>

      <template #body="{ row: access }">
        <td class="py-2 px-7">
          {{ access.team.name }}
        </td>

        <td class="py-2 px-7">
          {{ formatDate(access.assignedAt) }}
        </td>

        <td @click.stop class="flex justify-end w-20">
          <div class="mr-5">
            <HoppButtonSecondary
              v-tippy="{ theme: 'tooltip' }"
              :icon="IconTrash"
              class="!hover:bg-red-600"
              @click="confirmTeamRevocation(access.team.id)"
            />
          </div>
        </td>
      </template>
    </HoppSmartTable>

    <!-- Modals -->
    <UserGroupsAssignTeamsModal
      v-if="showAssignTeamsModal"
      :group-id="groupId"
      @hide-modal="showAssignTeamsModal = false"
      @teams-assigned="onTeamsAssigned"
    />

    <HoppSmartConfirmModal
      :show="confirmRevocation"
      :title="t('user_groups.confirm_revoke_team')"
      @hide-modal="resetConfirmRevocation"
      @resolve="revokeTeam(revokeTeamId)"
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
  GetUserGroupTeamAccessDocument,
  RevokeGroupFromTeamDocument,
} from '~/helpers/backend/graphql';
import UserGroupsAssignTeamsModal from './AssignTeamsModal.vue';
import IconPlus from '~icons/lucide/plus';
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
  { key: 'team.name', label: t('user_groups.team_name') },
  { key: 'assignedAt', label: t('user_groups.assigned_at') },
  { key: '', label: '' },
];

// Fetch teams
const { data, fetching, error, executeQuery } = useQuery({
  query: GetUserGroupTeamAccessDocument,
  variables: { groupId: props.groupId },
});

const teamsList = computed(() => data.value?.userGroupTeamAccess || []);

// Assign teams modal
const showAssignTeamsModal = ref(false);

const onTeamsAssigned = async () => {
  showAssignTeamsModal.value = false;
  await executeQuery();
  toast.success(t('user_groups.teams_assigned_success'));
};

// Revoke team
const confirmRevocation = ref(false);
const revokeTeamId = ref<string | null>(null);
const teamRevocation = useMutation(RevokeGroupFromTeamDocument);

const confirmTeamRevocation = (teamId: string) => {
  confirmRevocation.value = true;
  revokeTeamId.value = teamId;
};

const resetConfirmRevocation = () => {
  confirmRevocation.value = false;
  revokeTeamId.value = null;
};

const revokeTeam = async (teamId: string | null) => {
  if (!teamId) return;

  const result = await teamRevocation.executeMutation({
    groupId: props.groupId,
    teamId: teamId,
  });

  if (result.error) {
    toast.error(t('user_groups.revoke_team_failure'));
  } else {
    toast.success(t('user_groups.revoke_team_success'));
    await executeQuery();
  }

  confirmRevocation.value = false;
  revokeTeamId.value = null;
};
</script>
