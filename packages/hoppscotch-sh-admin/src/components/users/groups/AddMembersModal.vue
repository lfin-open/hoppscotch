<template>
  <HoppSmartModal
    dialog
    :title="t('user_groups.add_members')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col">
        <div class="flex items-center justify-between flex-1 pt-4 pb-2">
          <label class="p-4 text-secondaryLight text-sm">
            {{ t('user_groups.add_members_description') }}
          </label>
          <div class="flex">
            <HoppButtonSecondary
              :icon="IconPlus"
              :label="t('user_groups.add_new_member')"
              filled
              @click="addNewMemberRow"
            />
          </div>
        </div>

        <div class="divide-y divide-dividerLight ">
          <div
            v-for="(member, index) in membersList"
            :key="`new-member-${index}`"
            class="border rounded border-divider flex divide-x divide-dividerLight mb-2"
          >
            <!-- User Autocomplete -->
            <div class="flex-1">
              <UserAutocomplete
                v-model="member.userUid"
                :placeholder="t('user_groups.search_user_placeholder')"
                :exclude-user-ids="getExcludedUserIds(index)"
                @user-selected="(user) => handleUserSelected(index, user)"
              />
            </div>

            <!-- Role Selector -->
            <span>
              <tippy
                interactive
                trigger="click"
                theme="popover"
                :on-shown="() => tippyActions![index]?.focus()"
              >
                <HoppSmartSelectWrapper>
                  <input
                    class="flex flex-1 px-4 py-2 bg-transparent cursor-pointer"
                    :placeholder="t('user_groups.role')"
                    :value="member.isAdmin ? t('user_groups.admin') : t('user_groups.member')"
                    readonly
                  />
                </HoppSmartSelectWrapper>
                <template #content="{ hide }">
                  <div
                    ref="tippyActions"
                    class="flex flex-col focus:outline-none"
                    tabindex="0"
                    @keyup.escape="hide()"
                  >
                    <HoppSmartItem
                      :label="t('user_groups.admin')"
                      :icon="member.isAdmin ? IconCircleDot : IconCircle"
                      :active="member.isAdmin"
                      @click="
                        () => {
                          updateMemberRole(index, true);
                          hide();
                        }
                      "
                    />
                    <HoppSmartItem
                      :label="t('user_groups.member')"
                      :icon="!member.isAdmin ? IconCircleDot : IconCircle"
                      :active="!member.isAdmin"
                      @click="
                        () => {
                          updateMemberRole(index, false);
                          hide();
                        }
                      "
                    />
                  </div>
                </template>
              </tippy>
            </span>

            <!-- Remove Button -->
            <div class="flex">
              <HoppButtonSecondary
                v-tippy="{ theme: 'tooltip' }"
                :title="t('user_groups.remove')"
                :icon="IconTrash"
                color="red"
                @click="removeMemberRow(index)"
              />
            </div>
          </div>

          <!-- Empty State -->
          <HoppSmartPlaceholder
            v-if="membersList.length === 0"
            :text="t('user_groups.no_members_to_add')"
          >
            <template #body>
              <HoppButtonSecondary
                :label="t('user_groups.add_new_member')"
                filled
                @click="addNewMemberRow"
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
          :label="t('action.add')"
          :loading="adding"
          @click="addMembers"
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
import { AddUserToGroupDocument } from '~/helpers/backend/graphql';
import UserAutocomplete from '~/components/common/UserAutocomplete.vue';
import IconPlus from '~icons/lucide/plus';
import IconTrash from '~icons/lucide/trash';
import IconCircle from '~icons/lucide/circle';
import IconCircleDot from '~icons/lucide/circle-dot';

const t = useI18n();
const toast = useToast();
const tippyActions = ref<any | null>(null);

const props = defineProps<{
  groupId: string;
}>();

const emit = defineEmits<{
  (event: 'hide-modal'): void;
  (event: 'members-added'): void;
}>();

// Member interface
interface MemberToAdd {
  userUid: string | null;
  isAdmin: boolean;
}

// Members list state
const membersList = ref<MemberToAdd[]>([
  {
    userUid: null,
    isAdmin: false,
  },
]);

// Add mutation
const addMutation = useMutation(AddUserToGroupDocument);
const adding = ref(false);

// Add new member row
const addNewMemberRow = () => {
  membersList.value.push({
    userUid: null,
    isAdmin: false,
  });
};

// Remove member row
const removeMemberRow = (index: number) => {
  membersList.value.splice(index, 1);
};

// Update member role
const updateMemberRole = (index: number, isAdmin: boolean) => {
  membersList.value[index].isAdmin = isAdmin;
};

// Handle user selection
const handleUserSelected = (index: number, user: any) => {
  membersList.value[index].userUid = user.uid;
};

// Get excluded user IDs (already selected in other rows)
const getExcludedUserIds = (currentIndex: number): string[] => {
  return membersList.value
    .map((m, idx) => (idx !== currentIndex && m.userUid ? m.userUid : null))
    .filter((uid): uid is string => uid !== null);
};

// Add all members
const addMembers = async () => {
  // Validate: check if at least one member is selected
  const validMembers = membersList.value.filter((m) => m.userUid !== null);

  if (validMembers.length === 0) {
    toast.error(t('user_groups.select_at_least_one_user'));
    return;
  }

  adding.value = true;

  // Add all members sequentially
  let successCount = 0;
  let errorCount = 0;

  for (const member of validMembers) {
    const result = await addMutation.executeMutation({
      groupId: props.groupId,
      userUid: member.userUid!,
      isAdmin: member.isAdmin,
    });

    if (result.error) {
      errorCount++;
      const errorMessage = result.error.message;

      // Show specific error for first failure
      if (errorCount === 1) {
        if (errorMessage.includes('USER_GROUP_MEMBER_EXISTS')) {
          toast.error(t('user_groups.member_already_exists'));
        } else if (errorMessage.includes('USER_INVALID_ID')) {
          toast.error(t('user_groups.user_not_found'));
        } else {
          toast.error(t('user_groups.add_members_failure'));
        }
      }
    } else {
      successCount++;
    }
  }

  adding.value = false;

  // Show summary
  if (successCount > 0) {
    toast.success(
      t('user_groups.members_added_count', { count: successCount })
    );
    emit('members-added');

    if (errorCount === 0) {
      emit('hide-modal');
      // Reset form
      membersList.value = [{ userUid: null, isAdmin: false }];
    }
  }

  if (errorCount > 0 && successCount === 0) {
    toast.error(t('user_groups.all_members_failed'));
  } else if (errorCount > 0) {
    toast.error(
      t('user_groups.some_members_failed', { count: errorCount })
    );
  }
};

const hideModal = () => {
  // Reset form
  membersList.value = [{ userUid: null, isAdmin: false }];
  emit('hide-modal');
};
</script>
