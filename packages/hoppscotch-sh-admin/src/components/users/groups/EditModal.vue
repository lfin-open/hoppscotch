<template>
  <HoppSmartModal
    dialog
    :title="t('user_groups.edit_group')"
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
          :label="t('action.save')"
          :loading="updating"
          @click="updateGroup"
        />
      </div>
    </template>
  </HoppSmartModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useMutation } from '@urql/vue';
import { useI18n } from '~/composables/i18n';
import { useToast } from '~/composables/toast';
import IconChevronDown from '~icons/lucide/chevron-down';
import IconCircle from '~icons/lucide/circle';
import IconCircleDot from '~icons/lucide/circle-dot';
import {
  UpdateUserGroupDocument,
  UserGroupTeamAccessRole,
} from '~/helpers/backend/graphql';

const t = useI18n();
const toast = useToast();

const props = defineProps<{
  group: {
    id: string;
    name: string;
    description?: string | null;
    role: UserGroupTeamAccessRole;
  };
}>();

const emit = defineEmits<{
  (event: 'hide-modal'): void;
  (event: 'group-updated'): void;
}>();

// Form State
const name = ref(props.group.name);
const description = ref(props.group.description || '');
const role = ref<UserGroupTeamAccessRole>(props.group.role);

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

// Watch for group changes
watch(
  () => props.group,
  (newGroup) => {
    name.value = newGroup.name;
    description.value = newGroup.description || '';
    role.value = newGroup.role;
  }
);

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

// Update Mutation
const updateMutation = useMutation(UpdateUserGroupDocument);
const updating = ref(false);

const updateGroup = async () => {
  const trimmedName = name.value.trim();

  if (!trimmedName) {
    toast.error(t('user_groups.name_required'));
    return;
  }

  updating.value = true;

  const result = await updateMutation.executeMutation({
    groupId: props.group.id,
    name: trimmedName !== props.group.name ? trimmedName : undefined,
    description:
      description.value.trim() !== (props.group.description || '')
        ? description.value.trim() || null
        : undefined,
    role: role.value !== props.group.role ? role.value : undefined,
  });

  updating.value = false;

  if (result.error) {
    toast.error(t('user_groups.update_group_failure'));
  } else {
    emit('group-updated');
  }
};

const hideModal = () => {
  emit('hide-modal');
};
</script>
