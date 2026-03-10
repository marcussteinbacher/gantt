<script setup>
import { ref, computed, nextTick } from 'vue';
import { useGantt } from '../composables/useGantt';
import { differenceInCalendarDays, addDays, subDays } from 'date-fns';

const props = defineProps({
  task: Object,
  groupColor: String
});

const { state, getTaskLeft, getTaskWidth, dateFromLeft, openContextMenu, shiftStartDate } = useGantt();

const getMinStartDate = () => {
    let earliest = new Date();

    state.groups.forEach(group => {
        group.tasks.forEach(task => {
            if (task.start) {
                const d = new Date(task.start);
                d.setHours(0, 0, 0, 0);
                if (d < earliest) earliest = d;
            }
        });
    });
    //return subDays(earliest, 3);
    return earliest;
};

const containerRef = ref(null);
const isEditingTitle = ref(false);
const titleInputRef = ref(null);

const onTitleDblClick = () => {
  isEditingTitle.value = true;
  nextTick(() => {
    if (titleInputRef.value) {
      titleInputRef.value.focus();
      titleInputRef.value.select();
    }
  });
};

const onTitleBlur = () => {
  isEditingTitle.value = false;
};

const onTitleKeydown = (e) => {
  if (e.key === 'Enter') {
    isEditingTitle.value = false;
  }
};

// computed styles
const left = computed(() => getTaskLeft(props.task.start));
const width = computed(() => getTaskWidth(props.task.start, props.task.end));

// Interaction states
const isDragging = ref(false);
const isResizingLeft = ref(false);
const isResizingRight = ref(false);
const isAdjustingProgress = ref(false);

const dragStartLeft = ref(0);
const dragStartClientX = ref(0);

// HERE
const dragStartScrollX = ref(0); // clientX + scrollLeft at drag start
// TO HERE

const scrollAnimationFrame = ref(null);
const currentPointerX = ref(0);

// Temporary visual overrides during drag
const tempLeft = ref(null);
const tempWidth = ref(null);
const tempProgress = ref(null);

const currentLeft = computed(() => tempLeft.value !== null ? tempLeft.value : left.value);
const currentWidth = computed(() => tempWidth.value !== null ? tempWidth.value : width.value);
const currentProgress = computed(() => tempProgress.value !== null ? tempProgress.value : props.task.progress);

// Handlers
const onPointerDown = (e, action) => {
  e.stopPropagation();
  e.target.setPointerCapture(e.pointerId);
  
  dragStartClientX.value = e.clientX;
  dragStartLeft.value = currentLeft.value;

  // HERE
  dragStartScrollX.value = e.clientX + (state.chartContainer?.scrollLeft ?? 0);
  dragStartLeft.value = currentLeft.value;
  
  if (action === 'drag') isDragging.value = true;
  if (action === 'resize-left') isResizingLeft.value = true;
  if (action === 'resize-right') isResizingRight.value = true;
  if (action === 'progress') isAdjustingProgress.value = true;

  currentPointerX.value = e.clientX;
  startAutoScroll();

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const startAutoScroll = () => {
  if (scrollAnimationFrame.value) return;
  
  const scrollLoop = () => {
    if (!state.chartContainer || (!isDragging.value && !isResizingLeft.value && !isResizingRight.value)) {
      stopAutoScroll();
      return;
    }

    const rect = state.chartContainer.getBoundingClientRect();
    const threshold = 20;
    const maxScrollSpeed = 10;
    
    let speed = 0;
    if (currentPointerX.value > rect.right - threshold) {
      const distance = currentPointerX.value - (rect.right - threshold);
      speed = Math.min(maxScrollSpeed, (distance / threshold) * maxScrollSpeed);
    } else if (currentPointerX.value < rect.left + threshold) {
      const distance = (rect.left + threshold) - currentPointerX.value;
      speed = -Math.min(maxScrollSpeed, (distance / threshold) * maxScrollSpeed);
    }

    if (speed !== 0) {
      state.chartContainer.scrollLeft += speed;
      // Trigger a simulated move to update the position of the bar relative to the now-scrolled container
      onPointerMove({ clientX: currentPointerX.value });
    }
    
    scrollAnimationFrame.value = requestAnimationFrame(scrollLoop);
  };
  
  scrollAnimationFrame.value = requestAnimationFrame(scrollLoop);
};

const stopAutoScroll = () => {
  if (scrollAnimationFrame.value) {
    cancelAnimationFrame(scrollAnimationFrame.value);
    scrollAnimationFrame.value = null;
  }
};

const onPointerMove = (e) => {
  if (e.clientX !== undefined) currentPointerX.value = e.clientX;

  // HERE
  const scrollLeft = state.chartContainer?.scrollLeft ?? 0;
  const currentScrollX = currentPointerX.value + scrollLeft;
  const deltaX = currentScrollX - dragStartScrollX.value;
  const snapToDay = (val) => Math.round(val / state.dayWidth) * state.dayWidth;

  if (isDragging.value) {
        tempLeft.value = snapToDay(dragStartLeft.value + deltaX);
    } else if (isResizingRight.value) {
        tempWidth.value = Math.max(state.dayWidth, snapToDay(width.value + deltaX));
    } else if (isResizingLeft.value) {
        const newLeft = snapToDay(dragStartLeft.value + deltaX);
        if ((dragStartLeft.value + width.value - newLeft) >= state.dayWidth) {
            tempLeft.value  = newLeft;
            tempWidth.value = dragStartLeft.value + width.value - newLeft;
        }
    }
  if (isAdjustingProgress.value && containerRef.value) {
    const rect = containerRef.value.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    let newProgress = (offsetX / rect.width) * 100;
    tempProgress.value = Math.max(0, Math.min(100, Math.round(newProgress)));
  }

  // TO HERE
  
  // Bi-directional timeline extension (adaptive, incremental)
  if (state.chartContainer && (isDragging.value || isResizingLeft.value || isResizingRight.value)) {
    const rect = state.chartContainer.getBoundingClientRect();
    const threshold = 0; // pixels from viewport edge to trigger extension

    const taskLeftEdge = rect.left + currentLeft.value - state.chartContainer.scrollLeft;
    const taskRightEdge = rect.left + currentLeft.value + currentWidth.value - state.chartContainer.scrollLeft;

    // right side: extend a few days based on overflow
    const rightOverflow = taskRightEdge - (rect.right - threshold);
    if (rightOverflow > 0) {
      const rawDays = Math.ceil(rightOverflow / state.dayWidth);
      const days = Math.max(1, Math.min(rawDays, 3));
      const dayAtTaskRight = Math.ceil((currentLeft.value + currentWidth.value) / state.dayWidth);
      state.draggingMaxDay = Math.max(state.draggingMaxDay || dayAtTaskRight, dayAtTaskRight + days + 5);
    } else {
      state.draggingMaxDay = null;
    }

    // left side: similarly incremental and keep task visible
    const leftOverflow = (rect.left + threshold) - taskLeftEdge;
    if (leftOverflow > 0 && state.chartContainer.scrollLeft < 10) {
      const rawDays = Math.ceil(leftOverflow / state.dayWidth);
      const days = Math.max(1, Math.min(rawDays, 3));
      const shiftPx = days * state.dayWidth;
      state.startDate = subDays(state.startDate, days);

      if (isDragging.value && tempLeft.value !== null) {
        tempLeft.value += shiftPx;
        dragStartLeft.value += shiftPx;
      } else if (isResizingLeft.value && tempLeft.value !== null) {
        tempLeft.value += shiftPx;
        dragStartLeft.value += shiftPx;
      }
      dragStartScrollX.value += shiftPx;
    }
  }

  //const deltaX = currentPointerX.value - dragStartClientX.value;
  //
  // Snap logic placeholder: we snap to dayWidth
  //const snapToDay = (val) => Math.round(val / state.dayWidth) * state.dayWidth;
  //
  //if (isDragging.value) {
  //  tempLeft.value = Math.max(0, snapToDay(dragStartLeft.value + deltaX));
  //} else if (isResizingRight.value) {
  //  const minWidth = state.dayWidth;
  //  tempWidth.value = Math.max(minWidth, snapToDay(width.value + deltaX));
  //} else if (isResizingLeft.value) {
  //  const minWidth = state.dayWidth;
  //  const newLeft = snapToDay(dragStartLeft.value + deltaX);
  //  if (newLeft >= 0 && (dragStartLeft.value + width.value - newLeft) >= minWidth) {
  //    tempLeft.value = newLeft;
  //    tempWidth.value = dragStartLeft.value + width.value - newLeft;
  //  }
  //} else if (isAdjustingProgress.value && containerRef.value) {
  //  const rect = containerRef.value.getBoundingClientRect();
  //  const offsetX = e.clientX - rect.left;
  //  let newProgress = (offsetX / rect.width) * 100;
  //  tempProgress.value = Math.max(0, Math.min(100, Math.round(newProgress)));
  //}
};

const onPointerUp = (e) => {
  stopAutoScroll();
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);

  // Apply changes to state
  if (isDragging.value && tempLeft.value !== null) {
    const daysOffset = Math.round(tempLeft.value / state.dayWidth);
    const duration = differenceInCalendarDays(props.task.end, props.task.start);
    props.task.start = addDays(state.startDate, daysOffset);
    props.task.end = addDays(props.task.start, duration);
  } else if (isResizingRight.value && tempWidth.value !== null) {
    const newDays = Math.round(tempWidth.value / state.dayWidth) - 1;
    props.task.end = addDays(props.task.start, newDays);
  } else if (isResizingLeft.value && tempLeft.value !== null) {
    const newStartDays = Math.round(tempLeft.value / state.dayWidth);
    props.task.start = addDays(state.startDate, newStartDays);
  } else if (isAdjustingProgress.value && tempProgress.value !== null) {
    props.task.progress = tempProgress.value;
  }

  state.startDate = getMinStartDate(); // HERE

  // Reset
  isDragging.value = false;
  isResizingLeft.value = false;
  isResizingRight.value = false;
  isAdjustingProgress.value = false;
  
  tempLeft.value = null;
  tempWidth.value = null;
  tempProgress.value = null;
  state.draggingMaxDay = null;
};
</script>

<template>
  <div 
    class="progress-bar-container"
    ref="containerRef"
    :style="{ 
      left: `${currentLeft}px`, 
      width: `${currentWidth}px` 
    }"
    :class="{ 'is-interacting': isDragging || isResizingLeft || isResizingRight }"
    @contextmenu.prevent.stop="openContextMenu($event, 'task', task.id)"
  >
    <!-- Background (Muted) -->
    <div 
      class="progress-bar-bg" 
      :style="{ backgroundColor: groupColor, opacity: 0.3 }"
      @pointerdown="onPointerDown($event, 'drag')"
    ></div>
    
    <!-- Fill (Bright) -->
    <div 
      class="progress-bar-fill" 
      :style="{ backgroundColor: groupColor, width: `${currentProgress}%` }"
      @pointerdown="onPointerDown($event, 'drag')"
    ></div>

    <!-- Title inside bar -->
    <div 
      v-if="!isEditingTitle" 
      class="progress-bar-title" 
      @pointerdown="onPointerDown($event, 'drag')"
      @dblclick.stop="onTitleDblClick"
    >
      {{ task.title }}
    </div>
    <input 
      v-else 
      ref="titleInputRef"
      type="text" 
      class="progress-bar-title-input" 
      v-model="task.title" 
      @blur="onTitleBlur" 
      @keydown="onTitleKeydown"
      @click.stop
      @pointerdown.stop
    />

    <!-- Resize Handles -->
    <div class="resize-handle left" @pointerdown="onPointerDown($event, 'resize-left')"></div>
    <div class="resize-handle right" @pointerdown="onPointerDown($event, 'resize-right')"></div>

    <!-- Progress Slider Handle -->
    <div 
      class="progress-slider-handle" 
      :style="{ left: `${currentProgress}%` }"
      @pointerdown.stop="onPointerDown($event, 'progress')"
    >
      <div class="slider-line"></div>
    </div>
  </div>
</template>

<style scoped>
.progress-bar-container {
  position: absolute;
  top: 2px;
  height: calc(var(--row-height) - 4px); /* 28px; -- row-height: 32 */
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
  user-select: none;
}

.progress-bar-container:hover {
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
}

.progress-bar-container.is-interacting {
  z-index: 10;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
  cursor: grab;
}

.progress-bar-container.is-interacting * {
  cursor: grabbing !important;
}

.progress-bar-bg {
  position: absolute;
  inset: 0;
  cursor: grab;
}

.progress-bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  cursor: grab;
}

.progress-bar-title {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: auto;
  cursor: grab;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}

.progress-bar-title-input {
  position: absolute;
  left: 4px;
  right: 4px;
  top: 3px;
  bottom: 3px;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text);
  background: white;
  border: 1px solid var(--color-border);
  outline: none;
  z-index: 20;
}

.resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  cursor: ew-resize;
  z-index: 5;
}

.resize-handle.left {
  left: 0;
}

.resize-handle.right {
  right: 0;
}

.progress-slider-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px; /* center on the % */
  cursor: col-resize;
  z-index: 6;
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.progress-bar-container:hover .progress-slider-handle,
.progress-slider-handle:active {
  opacity: 1;
}

.slider-line {
  width: 3px;
  height: 16px;
  background-color: white;
  border-radius: 2px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
</style>
