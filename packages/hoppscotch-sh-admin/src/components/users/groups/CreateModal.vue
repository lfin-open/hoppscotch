<template>
  <HoppSmartModal
    dialog
    :title="t('user_groups.create_group')"
    @close="emit('hide-modal')"
  >
    <template #body>
      <div class="flex flex-col space-y-4">
        <HoppSmartInput
          v-model="name"
          :label="t('user_groups.group_name')"
          input-styles="floating-input"
        />

        <HoppSmartInput
          v-model="description"
          :label="t('user_groups.description_placeholder')"
          input-styles="floating-input"
        />

        <div class="flex flex-col">
          <label class="text-secondaryLight text-tiny mb-2">
            {{ t('user_groups.default_role') }}
          </label>
          <tippy
            interactive
            trigger="click"
            theme="popover"
            placement="top-start"
            :on-shown="() => tippyActions?.focus()"
          >
            <span class="relative">
              <input
                class="flex flex-1 w-full px-4 py-2 bg-primary border border-divider rounded cursor-pointer"
                :placeholder="t('user_groups.default_role')"
                :value="getRoleLabel(role)"
                readonly
              />
              <span
                class="absolute right-4 top-1/2 transform !-translate-y-1/2"
              >
                <IconChevronDown />
              </span>
            </span>
            <template #content="{ hide }">
              <div
                ref="tippyActions"
                class="flex flex-col focus:outline-none"
                tabindex="0"
                @keyup.escape="hide()"
              >
                <HoppSmartItem
                  :label="t('user_groups.role_viewer')"
                  :icon="
                    role === UserGroupTeamAccessRole.Viewer
                      ? IconCircleDot
                      : IconCircle
                  "
                  :active="role === UserGroupTeamAccessRole.Viewer"
                  @click="
                    () => {
                      role = UserGroupTeamAccessRole.Viewer;
                      hide();
                    }
                  "
                />
                <HoppSmartItem
                  :label="t('user_groups.role_editor')"
                  :icon="
                    role === UserGroupTeamAccessRole.Editor
                      ? IconCircleDot
                      : IconCircle
                  "
                  :active="role === UserGroupTeamAccessRole.Editor"
                  @click="
                    () => {
                      role = UserGroupTeamAccessRole.Editor;
                      hide();
                    }
                  "
                />
                <HoppSmartItem
                  :label="t('user_groups.role_owner')"
                  :icon="
                    role === UserGroupTeamAccessRole.Owner
                      ? IconCircleDot
                      : IconCircle
                  "
                  :active="role === UserGroupTeamAccessRole.Owner"
                  @click="
                    () => {
                      role = UserGroupTeamAccessRole.Owner;
                      hide();
                    }
                  "
                />
              </div>
            </template>
          </tippy>
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
          :label="t('action.create')"
          :loading="creating"
          @click="createGroup"
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
import IconChevronDown from '~icons/lucide/chevron-down';
import IconCircle from '~icons/lucide/circle';
import IconCircleDot from '~icons/lucide/circle-dot';
import {
  CreateUserGroupDocument,
  UserGroupTeamAccessRole,
} from '~/helpers/backend/graphql';

const t = useI18n();
const toast = useToast();

const emit = defineEmits<{
  (event: 'hide-modal'): void;
  (event: 'group-created'): void;
}>();

// Form State
const name = ref('');
const description = ref('');
const role = ref<UserGroupTeamAccessRole>(UserGroupTeamAccessRole.Viewer);

// Template ref
const tippyActions = ref<any | null>(null);

// Helper function to get role label
const getRoleLabel = (roleValue: UserGroupTeamAccessRole) => {
  const labels = {
    [UserGroupTeamAccessRole.Viewer]: t('user_groups.role_viewer'),
    [UserGroupTeamAccessRole.Editor]: t('user_groups.role_editor'),
    [UserGroupTeamAccessRole.Owner]: t('user_groups.role_owner'),
  };
  return labels[roleValue];
};

// Role Options
const roleOptions = [
  {
    label: t('user_groups.role_viewer'),
    value: UserGroupTeamAccessRole.Viewer,
  },
  {
    label: t('user_groups.role_editor'),
    value: UserGroupTeamAccessRole.Editor,
  },
  {
    label: t('user_groups.role_owner'),
    value: UserGroupTeamAccessRole.Owner,
  },
];

// Create Mutation
const createMutation = useMutation(CreateUserGroupDocument);
const creating = ref(false);

const createGroup = async () => {
  const trimmedName = name.value.trim();

  if (!trimmedName) {
    toast.error(t('user_groups.name_required'));
    return;
  }

  creating.value = true;

  const result = await createMutation.executeMutation({
    name: trimmedName,
    description: description.value.trim() || null,
    role: role.value,
  });

  creating.value = false;

  if (result.error) {
    toast.error(t('user_groups.create_group_failure'));
  } else {
    emit('group-created');
  }
};

const hideModal = () => {
  emit('hide-modal');
};
</script>
