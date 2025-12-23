<template>
  <HoppSmartModal
    dialog
    :title="t('user_groups.assign_teams')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col">
        <div class="flex items-center justify-between flex-1 pt-4 pb-2">
          <label class="p-4 text-secondaryLight text-sm">
            {{ t('user_groups.assign_teams_description') }}
          </label>
          <div class="flex">
            <HoppButtonSecondary
              :icon="IconPlus"
              :label="t('user_groups.add_new_team')"
              filled
              @click="addNewTeamRow"
            />
          </div>
        </div>

        <div class="divide-y divide-dividerLight ">
          <div
            v-for="(team, index) in teamsList"
            :key="`new-team-${index}`"
            class="border rounded border-divider flex divide-x divide-dividerLight mb-2"
          >
            <!-- Team Autocomplete -->
            <div class="flex-1">
              <TeamAutocomplete
                v-model="team.teamId"
                :placeholder="t('user_groups.search_team_placeholder')"
                :exclude-team-ids="getExcludedTeamIds(index)"
                @team-selected="(selectedTeam) => handleTeamSelected(index, selectedTeam)"
              />
            </div>

            <!-- Remove Button -->
            <div class="flex">
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('user_groups.remove')"
                :icon="IconTrash"
                color="red"
                @click="removeTeamRow(index)"
              />
            </div>
          </div>

          <!-- Empty State -->
          <HoppSmartPlaceholder
            v-if="teamsList.length === 0"
            :text="t('user_groups.no_teams_to_assign')"
          >
            <template #body>
              <HoppButtonSecondary
                :label="t('user_groups.add_new_team')"
                filled
                @click="addNewTeamRow"
              />
            </template>
          </HoppSmartPlaceholder>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end space-x-2">
        <HoppButtonSecondary
          :label="t('action.cancel')"
          outline
          filled
          @click="hideModal"
        />
        <HoppButtonPrimary
          :label="t('action.assign')"
          :loading="assigning"
          @click="assignTeams"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMutation } from '@urql/vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import { AssignGroupToTeamDocument } from '~/helpers/backend/graphql';
import TeamAutocomplete from '~/components/common/TeamAutocomplete.vue';
import IconPlus from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash';

const t = useI18n();
const toast = useToast();

const props = defineProps<{
  groupId: string;
}>();

const emit = defineEmits<{
  (event: 'hide-modal'): void;
  (event: 'teams-assigned'): void;
}>();

// Team interface
interface TeamToAssign {
  teamId: string | null;
}

// Teams list state
const teamsList = ref<TeamToAssign[]>([
  {
    teamId: null,
  },
]);

// Assign mutation
const assignMutation = useMutation(AssignGroupToTeamDocument);
const assigning = ref(false);

// Add new team row
const addNewTeamRow = () => {
  teamsList.value.push({
    teamId: null,
  });
};

// Remove team row
const removeTeamRow = (index: number) => {
  teamsList.value.splice(index, 1);
};

// Handle team selection
const handleTeamSelected = (index: number, team: any) => {
  teamsList.value[index].teamId = team.id;
};

// Get excluded team IDs (already selected in other rows)
const getExcludedTeamIds = (currentIndex: number): string[] => {
  return teamsList.value
    .map((t, idx) => (idx !== currentIndex && t.teamId ? t.teamId : null))
    .filter((id): id is string => id !== null);
};

// Assign all teams
const assignTeams = async () => {
  // Validate: check if at least one team is selected
  const validTeams = teamsList.value.filter((t) => t.teamId !== null);

  if (validTeams.length === 0) {
    toast.error(t('user_groups.select_at_least_one_team'));
    return;
  }

  assigning.value = true;

  // Assign all teams sequentially
  let successCount = 0;
  let errorCount = 0;

  for (const team of validTeams) {
    const result = await assignMutation.executeMutation({
      groupId: props.groupId,
      teamId: team.teamId!,
    });

    if (result.error) {
      errorCount++;
      const errorMessage = result.error.message;

      // Show specific error for first failure
      if (errorCount === 1) {
        if (errorMessage.includes('USER_GROUP_TEAM_ACCESS_EXISTS')) {
          toast.error(t('user_groups.team_already_assigned'));
        } else if (errorMessage.includes('TEAM_INVALID_ID')) {
          toast.error(t('user_groups.team_not_found'));
        } else {
          toast.error(t('user_groups.assign_teams_failure'));
        }
      }
    } else {
      successCount++;
    }
  }

  assigning.value = false;

  // Show summary
  if (successCount > 0) {
    toast.success(
      t('user_groups.teams_assigned_count', { count: successCount })
    );
    emit('teams-assigned');

    if (errorCount === 0) {
      emit('hide-modal');
      // Reset form
      teamsList.value = [{ teamId: null }];
    }
  }

  if (errorCount > 0 && successCount === 0) {
    toast.error(t('user_groups.all_teams_failed'));
  } else if (errorCount > 0) {
    toast.error(
      t('user_groups.some_teams_failed', { count: errorCount })
    );
  }
};

const hideModal = () => {
  // Reset form
  teamsList.value = [{ teamId: null }];
  emit('hide-modal');
};
</script>
