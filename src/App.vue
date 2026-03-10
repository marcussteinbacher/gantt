<script setup>
import { computed } from 'vue';
import { useGantt } from './composables/useGantt';
import GanttChart from './components/GanttChart.vue';

const { state, zoomIn, zoomOut, saveProject, loadProject } = useGantt();

// Two-way binding for the date input (needs yyyy-MM-dd string format)
const startDateStr = computed({
  get: () => {
    const d = state.startDate;
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
  set: (val) => {
    if (val) state.startDate = new Date(val + 'T00:00:00');
  }
});

const onFileChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    loadProject(event.target.result);
    // Clear input so same file can be loaded again
    e.target.value = '';
  };
  reader.readAsText(file);
};

const triggerFileInput = () => {
  const input = document.getElementById('file-input');
  if (input) input.click();
};
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <input type="text" class="app-title-input" v-model="state.chartTitle" />
      <div class="actions">
        <input type="file" id="file-input" style="display: none" accept=".json" @change="onFileChange" />
        <button class="text-btn" @click="saveProject">Save JSON</button>
        <button class="text-btn" @click="triggerFileInput">Load JSON</button>
        <div class="divider"></div>
        <input type="date" class="date-input" v-model="startDateStr" title="Start Date" />
        <button class="icon-btn" @click="zoomOut" title="Zoom Out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
        <button class="icon-btn" @click="zoomIn" title="Zoom In">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </button>
      </div>
    </header>
    <main class="gantt-wrapper">
      <GanttChart />
    </main>
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.app-header {
  height: var(--header-height);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-bg-canvas);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.app-title-input {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  border: none;
  background: none;
  outline: none;
  color: var(--color-text);
  font-family: inherit;
  padding: 4px 0;
}
.app-title-input:focus {
  background: var(--color-bg-app);
  border-radius: 4px;
  padding: 4px 8px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-btn {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.text-btn:hover {
  background-color: #f4f4f5;
  color: var(--color-text);
}

.divider {
  width: 1px;
  height: 24px;
  background-color: var(--color-border);
  margin: 0 4px;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.icon-btn:hover {
  background-color: #f4f4f5;
  color: var(--color-text);
}

.date-input {
  font-family: inherit;
  font-size: 0.8125rem;
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text);
  background: var(--color-bg-app);
  outline: none;
  cursor: pointer;
}

.date-input:focus {
  border-color: #a1a1aa;
}

.gantt-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
