<template>
  <div class="flex flex-col space-y-4">
    <h3 class="text-lg font-semibold">{{ t('user_groups.audit_log') }}</h3>

    <HoppSmartTable
      v-model:list="auditLogsList"
      :headings="headings"
      :loading="fetching"
    >
      <template #head>
        <th class="px-6 py-2">{{ t('user_groups.action') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.target_type') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.performed_by') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.performed_at') }}</th>
        <th class="px-6 py-2">{{ t('user_groups.ip_address') }}</th>
      </template>

      <template #empty-state>
        <td colspan="5">
          <span class="flex justify-center p-3">
            {{
              error
                ? t('user_groups.load_audit_logs_error')
                : t('user_groups.no_audit_logs')
            }}
          </span>
        </td>
      </template>

      <template #body="{ row: log }">
        <td
          class="py-2 px-7 cursor-pointer hover:bg-primaryLight transition"
          @click="openDetailsModal(log)"
        >
          <span
            class="text-xs font-medium px-2 py-1 rounded bg-primaryDark text-secondaryLight"
          >
            {{ log.action }}
          </span>
        </td>

        <td
          class="py-2 px-7 cursor-pointer hover:bg-primaryLight transition"
          @click="openDetailsModal(log)"
        >
          {{ log.targetType }}
        </td>

        <td
          class="py-2 px-7 cursor-pointer hover:bg-primaryLight transition"
          @click="openDetailsModal(log)"
        >
          <div class="flex flex-col">
            <span class="font-medium truncate">
              {{ log.user?.displayName || log.user?.email || t('users.unnamed') }}
            </span>
            <span v-if="log.user?.displayName" class="text-xs text-secondaryLight">
              {{ log.user.email }}
            </span>
          </div>
        </td>

        <td
          class="py-2 px-7 cursor-pointer hover:bg-primaryLight transition"
          @click="openDetailsModal(log)"
        >
          {{ formatDate(log.performedAt) }}
        </td>

        <td
          class="py-2 px-7 cursor-pointer hover:bg-primaryLight transition"
          @click="openDetailsModal(log)"
        >
          {{ log.ipAddress || '' }}
        </td>
      </template>
    </HoppSmartTable>

    <!-- Details Modal -->
    <HoppSmartModal
      v-if="showDetailsModal"
      dialog
      :title="t('user_groups.audit_log_details')"
      @close="showDetailsModal = false"
    >
      <template #body>
        <div class="flex flex-col space-y-4">
          <!-- Action -->
          <div>
            <label class="text-secondaryLight text-sm">{{ t('user_groups.action') }}</label>
            <div class="mt-1">
              <span
                class="text-xs font-medium px-2 py-1 rounded bg-primaryDark text-secondaryLight"
              >
                {{ selectedLog?.action }}
              </span>
            </div>
          </div>

          <!-- Target Type & ID -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-secondaryLight text-sm">{{ t('user_groups.target_type') }}</label>
              <div class="mt-1 font-medium">{{ selectedLog?.targetType }}</div>
            </div>
            <div>
              <label class="text-secondaryLight text-sm">{{ t('user_groups.target_id') }}</label>
              <div class="mt-1 font-medium">{{ selectedLog?.targetId || '' }}</div>
            </div>
          </div>

          <!-- Performed By -->
          <div>
            <label class="text-secondaryLight text-sm">{{ t('user_groups.performed_by') }}</label>
            <div class="mt-1">
              <div class="flex flex-col">
                <span class="font-medium">
                  {{ selectedLog?.user?.displayName || selectedLog?.user?.email || t('users.unnamed') }}
                </span>
                <span v-if="selectedLog?.user?.displayName" class="text-xs text-secondaryLight">
                  {{ selectedLog?.user.email }}
                </span>
              </div>
            </div>
          </div>

          <!-- Performed At -->
          <div>
            <label class="text-secondaryLight text-sm">{{ t('user_groups.performed_at') }}</label>
            <div class="mt-1 font-medium">{{ selectedLog ? formatDate(selectedLog.performedAt) : '' }}</div>
          </div>

          <!-- IP Address -->
          <div>
            <label class="text-secondaryLight text-sm">{{ t('user_groups.ip_address') }}</label>
            <div class="mt-1 font-medium">{{ selectedLog?.ipAddress || '' }}</div>
          </div>

          <!-- Details JSON -->
          <div v-if="selectedLog?.details">
            <label class="text-secondaryLight text-sm">{{ t('user_groups.details') }}</label>
            <div class="mt-1 p-3 bg-primaryLight rounded font-mono text-xs overflow-auto max-h-64">
              <pre>{{ formatDetails(selectedLog.details) }}</pre>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <HoppButtonSecondary
            :label="t('action.close')"
            outline
            filled
            @click="showDetailsModal = false"
          />
        </div>
      </template>
    </HoppSmartModal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQuery } from '@urql/vue';
import { format } from 'date-fns';
import { useI18n } from '~/composables/i18n';
import { GetUserGroupAuditLogsDocument } from '~/helpers/backend/graphql';

const t = useI18n();

const props = defineProps<{
  groupId: string;
}>();

// Modal state
const showDetailsModal = ref(false);
const selectedLog = ref<any>(null);

// Format helper
const formatDate = (date: string) => {
  return format(new Date(date), 'dd MMM yyyy, hh:mm a');
};

// Format details JSON
const formatDetails = (details: string | null) => {
  if (!details) return '';
  try {
    const parsed = JSON.parse(details);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return details;
  }
};

// Open details modal
const openDetailsModal = (log: any) => {
  selectedLog.value = log;
  showDetailsModal.value = true;
};

// Table headings
const headings = [
  { key: 'action', label: t('user_groups.action') },
  { key: 'targetType', label: t('user_groups.target_type') },
  { key: 'performedBy', label: t('user_groups.performed_by') },
  { key: 'performedAt', label: t('user_groups.performed_at') },
  { key: 'ipAddress', label: t('user_groups.ip_address') },
];

// Fetch audit logs
const { data, fetching, error } = useQuery({
  query: GetUserGroupAuditLogsDocument,
  variables: { groupId: props.groupId, limit: 100, offset: 0 },
});

const auditLogsList = computed(() => data.value?.userGroupAuditLogs || []);
</script>
