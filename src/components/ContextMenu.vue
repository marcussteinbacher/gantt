<script setup>
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useGantt } from '../composables/useGantt';
import { barColors } from '../composables/colors';

const { state, contextMenu, closeContextMenu, addGroup, insertGroupAfter, removeGroup, addTask, removeTask, changeGroupColor } = useGantt();

const isVisible = computed(() => contextMenu.visible);

const menuRef = ref(null);

// Adjusted position that keeps the menu inside the viewport
const adjustedPos = ref({ left: 0, top: 0 });

// Whenever the menu becomes visible, measure it and clamp to viewport
const updatePosition = async () => {
  await nextTick();
  if (!menuRef.value) return;
  const rect = menuRef.value.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = contextMenu.x;
  let y = contextMenu.y;
  if (x + rect.width > vw) x = vw - rect.width - 8;
  if (y + rect.height > vh) y = vh - rect.height - 8;
  if (x < 8) x = 8;
  if (y < 8) y = 8;
  adjustedPos.value = { left: x, top: y };
};

const positionStyles = computed(() => ({
  left: `${adjustedPos.value.left}px`,
  top: `${adjustedPos.value.top}px`
}));

const handleAddGroup = () => { addGroup(); closeContextMenu(); };
const handleAddGroupAfter = (groupId) => {insertGroupAfter(groupId); closeContextMenu(); };
const handleRemoveGroup = () => { removeGroup(contextMenu.targetId); closeContextMenu(); };
const handleAddTask = (groupId) => { addTask(groupId); closeContextMenu(); };
const handleRemoveTask = () => { removeTask(contextMenu.targetId); closeContextMenu(); };

const handleColorSelect = (color) => {
  changeGroupColor(contextMenu.targetId, color);
  closeContextMenu();
};

const onClickOutside = () => {
  if (isVisible.value) closeContextMenu();
};

onMounted(() => window.addEventListener('click', onClickOutside));
onUnmounted(() => window.removeEventListener('click', onClickOutside));

// Re-clamp position every time the menu opens
watch(isVisible, (visible) => {
  if (visible) updatePosition();
});

// Also update position when mouse coordinates change (for consecutive right-clicks)
watch([() => contextMenu.x, () => contextMenu.y], () => {
  if (isVisible.value) updatePosition();
});
</script>

<template>
  <div 
    v-if="isVisible" 
    ref="menuRef" 
    class="context-menu" 
    :style="positionStyles" 
    @click.stop
  >
    
    <!-- Chart background context -->
    <template v-if="contextMenu.targetType === 'chart'">
      <button class="menu-item" @click="handleAddGroup">
        <span class="menu-icon">+</span> New Group
      </button>
    </template>

    <!-- Group context -->
    <template v-else-if="contextMenu.targetType === 'group'">
      <button class="menu-item" @click="handleAddTask(contextMenu.targetId)">
        <span class="menu-icon">+</span> Add Task
      </button>
      <button class="menu-item" @click="handleAddGroupAfter(contextMenu.targetId)">
        <span class="menu-icon">+</span> New Group
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item text-danger" @click="handleRemoveGroup">
        <span class="menu-icon">−</span> Remove Group
      </button>
      <div class="menu-divider"></div>
      <div class="color-picker">
        <div 
          v-for="color in barColors" 
          :key="color" 
          class="color-option"
          :style="{ backgroundColor: color }"
          @click="handleColorSelect(color)"
        ></div>
      </div>
    </template>

    <!-- Task context -->
    <template v-else-if="contextMenu.targetType === 'task'">
      <button class="menu-item" @click="handleAddTask(contextMenu.parentGroupId)">
        <span class="menu-icon">+</span> Add Task
      </button>
      <button class="menu-item" @click="handleAddGroupAfter(contextMenu.parentGroupId)">
        <span class="menu-icon">+</span> New Group
      </button>
      <div class="menu-divider"></div>
      <button class="menu-item text-danger" @click="handleRemoveTask">
        <span class="menu-icon">−</span> Remove Task
      </button>
    </template>

  </div>
</template>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--color-bg-canvas);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
  border-radius: 8px;
  min-width: 170px;
  padding: 6px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-item {
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 0.8125rem;
  color: var(--color-text);
  background: transparent;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-icon {
  width: 16px;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  line-height: 1;
}

.menu-item:hover {
  background: #f4f4f5;
}

.menu-item.text-danger {
  color: #ef4444;
}

.menu-item.text-danger:hover {
  background: #fef2f2;
}

.menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 2px 0;
}

.color-picker {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.1s;
}

.color-option:hover {
  transform: scale(1.2);
}
</style>
