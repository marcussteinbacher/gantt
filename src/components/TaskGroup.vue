<script setup>
import { defineProps } from 'vue';
import { useGantt } from '../composables/useGantt';

const props = defineProps({
  group: Object
});

const { openContextMenu } = useGantt();
</script>

<template>
  <div class="task-group">
    <div class="group-header" @contextmenu.prevent="openContextMenu($event, 'group', group.id)">
      <div class="color-indicator" :style="{ backgroundColor: group.color }"></div>
      <input type="text" class="group-name-input" v-model="group.name" />
    </div>
    <div class="task-list">
      <div 
        v-for="task in group.tasks" 
        :key="task.id" 
        class="task-item"
        @contextmenu.prevent="openContextMenu($event, 'task', task.id)"
      >
        <input type="text" class="task-title-input" v-model="task.title" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-group {
  margin-bottom: 0;
}

.group-header {
  height: var(--row-height);
  display: flex;
  align-items: center;
  padding: 0 12px;
  position: sticky;
  top: 0;
  background-color: var(--color-group-bg);
  border-bottom: 1px solid var(--color-border);
  z-index: 10;
}

.color-indicator {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 10px;
  /*cursor: pointer;*/
  flex-shrink: 0;
}

.group-name-input {
  flex: 1;
  font-weight: 600;
  font-size: 0.8125rem;
  color: var(--color-text);
  /*padding: 2px 0;*/
}
.group-name-input:focus {
  background: var(--color-bg-canvas);
  border-radius: 4px;
  /*padding: 2px 6px;
  margin-left: -6px;*/
}

.task-item {
  height: var(--row-height);
  display: flex;
  align-items: center;
  padding: 0 12px 0 32px;
  border-bottom: 1px solid var(--color-grid, #f4f4f5);
}

.task-item:hover {
  background-color: #f9f9fb;
}

.task-title-input {
  flex: 1;
  font-size: 0.8125rem;
  color: var(--color-text);
  padding: 2px 0;
}
.task-title-input:focus {
  background: var(--color-bg-canvas);
  border-radius: 4px;
  /*padding: 2px 6px;
  margin-left: -6px;*/
}
</style>
