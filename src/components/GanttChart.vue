<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useScroll } from '@vueuse/core';
import TimelineHeader from './TimelineHeader.vue';
import TaskGroup from './TaskGroup.vue';
import ProgressBar from './ProgressBar.vue';
import ContextMenu from './ContextMenu.vue';
import { useGantt } from '../composables/useGantt';

const { state, chartWidth, openContextMenu, todayLeft, todayMiddle, jumpToToday, jumpToStart, jumpToEnd, exportToSVG } = useGantt();

const chartContainer = ref(null);
const sidebarContent = ref(null);

const root = document.documentElement;
const rowHeight = parseInt(getComputedStyle(root).getPropertyValue('--row-height'));
const sidebarWidth = parseInt(getComputedStyle(root).getPropertyValue('--sidebar-width'));

console.log(rowHeight)

// Compute total content height based on groups + tasks
const contentHeight = computed(() => {
  let rows = 0;
  state.groups.forEach(g => {
    rows += 1; // group header row
    rows += g.tasks.length; // task rows
  });
  return rows * rowHeight; // --row-height: 32px
});

// Update viewportWidth so totalDays always covers the visible area
const updateViewportWidth = () => {
  if (chartContainer.value) {
    state.viewportWidth = chartContainer.value.clientWidth + sidebarWidth; // include sidebar
  }
};

onMounted(() => {
  state.chartContainer = chartContainer.value;
  updateViewportWidth();
  window.addEventListener('resize', updateViewportWidth);
  
  // Jump to today after a short delay to ensure everything is rendered
  setTimeout(() => {
    jumpToToday(chartContainer.value);
  }, 100);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportWidth);
});

const { x, y } = useScroll(chartContainer);

const onScroll = () => {
  if (chartContainer.value && sidebarContent.value) {
    if (Math.abs(sidebarContent.value.scrollTop - chartContainer.value.scrollTop) > 0.5) {
      sidebarContent.value.scrollTop = chartContainer.value.scrollTop;
    }
  }
};

const onSidebarScroll = () => {
  if (chartContainer.value && sidebarContent.value) {
    if (Math.abs(chartContainer.value.scrollTop - sidebarContent.value.scrollTop) > 0.5) {
      chartContainer.value.scrollTop = sidebarContent.value.scrollTop;
    }
  }
};
</script>

<template>
  <div class="gantt-layout">
    <div class="sidebar" :style="{ width: `${state.sidebarWidth}px` }">
      <div class="sidebar-header">
        <button class="today-btn" @click="jumpToStart(chartContainer)">Start</button>
        <button class="today-btn" @click="jumpToToday(chartContainer)">Today</button>
        <button class="today-btn" @click="jumpToEnd(chartContainer)">End</button>
      </div>

      <div class="sidebar-content" ref="sidebarContent" @scroll="onSidebarScroll" @contextmenu.self.prevent="openContextMenu($event, 'chart')">
        <TaskGroup 
          v-for="group in state.groups" 
          :key="group.id" 
          :group="group" 
        />
      </div>
    </div>
    
    <div class="timeline-area">
      <div class="timeline-header-wrapper">
        <TimelineHeader :style="{ transform: `translateX(-${x}px)` }" />
      </div>

      
      <!--<div class="chart-container" ref="chartContainer" @scroll="onScroll" @contextmenu.prevent="openContextMenu($event, 'chart')"> -->
      <div class="chart-container" ref="chartContainer" @scroll="onScroll">
        <div 
          class="grid-background" 
          :style="{ 
            width: `${chartWidth}px`, 
            height: `${contentHeight}px`,
            backgroundSize: `${state.dayWidth}px 100%` 
          }"
        ></div>
        
        <div 
          class="today-line" 
          :style="{ 
            left: `${todayMiddle}px`, 
            height: `${contentHeight}px` 
          }"
        ></div>

        
        <div class="chart-content" :style="{ width: `${chartWidth}px` }">
           <div v-for="group in state.groups" :key="'chart-'+group.id" class="chart-group">
              <div class="group-row">
                <div class="group-header-chart">
                  <div class="color-indicator" :style="{ backgroundColor: group.color }"></div>
                  <span class="group-name">{{ group.name }}</span>
                </div>
              </div>
              <div v-for="task in group.tasks" :key="'row-'+task.id" class="task-row">
                 <ProgressBar :task="task" :groupColor="group.color" />
              </div>
           </div>
        </div>
      </div>
    </div>
    
    <ContextMenu />
  </div>
</template>

<style scoped>
.gantt-layout {
  display: flex;
  height: 100%;
  width: 100%;
}

.sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-group-bg);
  z-index: 2;
  box-shadow: 2px 0 5px rgba(0,0,0,0.02);
}

.sidebar-header {
  height: var(--row-height);
  display: flex;
  align-items: center;
  padding: 0 16px;
  font-weight: 500;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: none; /* Firefox */
  padding-bottom: 8px;

}

.sidebar-content::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.timeline-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  background-color: var(--color-timeline-bg);
}

.timeline-header-wrapper {
  height: var(--row-height);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-timeline-bg);
  z-index: 10; /* Above the grid/tasks */
  flex-shrink: 0;
  /* Removed overflow: hidden to allow today-marker to sit on border */
}

.chart-container {
  flex: 1;
  overflow: auto;
  position: relative;
}

.grid-background {
  position: absolute;
  top: 0;
  left: 0;
  background-image: linear-gradient(to right, var(--color-grid) 1px, transparent 1px);
  pointer-events: none;
}

.chart-content {
  position: relative;
  min-height: 100%;
}

.group-row {
  height: var(--row-height);
  background-color: rgba(244, 244, 245, 0.4);
}

.task-row {
  height: var(--row-height);
  border-bottom: 1px solid var(--color-grid);
  position: relative;
}
.today-line {
  position: absolute;
  top: 0;
  width: 1px;
  background-color: var(--color-today);
  pointer-events: none;
  z-index: 1;
}
.today-btn {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-today);
  padding: 4px 8px;
  border: 1px solid var(--color-today);
  border-radius: 4px;
  margin-left: auto;
  margin-right: 12px;
  transition: all 0.2s;
}
.today-btn:hover {
  background-color: var(--color-today);
  color: white;
}

.group-header-chart {
  display: none; /* Hidden by default, shown in print */
  align-items: center;
  padding: 0 12px;
  height: 100%;
  font-weight: 600;
  color: var(--color-text);
}

.color-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.group-name {
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

