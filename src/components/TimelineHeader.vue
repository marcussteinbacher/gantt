<script setup>
import { computed, ref } from 'vue';
import { addDays, addWeeks, startOfWeek, format, differenceInCalendarDays, differenceInWeeks, differenceInMonths, addMonths, startOfMonth } from 'date-fns';
import { useGantt } from '../composables/useGantt';

//const { state, totalDays, chartWidth, endDate, todayLeft, todayMiddle } = useGantt();
const { state, totalDays, chartWidth, endDate, todayMiddle } = useGantt();

// Fix: state.startDate -> startDate.value; startDate from the composable destructure for useGantt().

// Determine scale mode based on dayWidth
// dayWidth >= 22 → day view
// dayWidth >= 8 → week view  
// dayWidth < 8 → month view
const scaleMode = computed(() => {
  if (state.dayWidth >= 22) return 'day';
  if (state.dayWidth >= 8) return 'week';
  return 'month';
});

// DAY-level ticks
const dayTicks = computed(() => {
  return Array.from({ length: totalDays.value }).map((_, i) => {
    const d = addDays(state.startDate, i);
    return {
      date: d,
      label: format(d, 'd'),
      monthLabel: format(d, 'MMM yyyy'),
      isFirstOfMonth: d.getDate() === 1 || i === 0,
      left: i * state.dayWidth,
      width: state.dayWidth,
    };
  });
});

// WEEK-level ticks
const weekTicks = computed(() => {
  const ticks = [];
  let current = startOfWeek(state.startDate, { weekStartsOn: 1 });
  if (current < state.startDate) current = addWeeks(current, 1);
  
  while (current <= endDate.value) {
    const dayOffset = differenceInCalendarDays(current, state.startDate);
    ticks.push({
      date: current,
      label: format(current, 'MMM d'),
      monthLabel: format(current, 'MMM yyyy'),
      isFirstOfMonth: current.getDate() <= 7,
      left: dayOffset * state.dayWidth,
      width: 7 * state.dayWidth,
    });
    current = addWeeks(current, 1);
  }
  return ticks;
});

// MONTH-level ticks
const monthTicks = computed(() => {
  const ticks = [];
  let current = startOfMonth(state.startDate);
  if (current < state.startDate) current = addMonths(current, 1);

  while (current <= endDate.value) {
    const dayOffset = differenceInCalendarDays(current, state.startDate);
    const nextMonth = addMonths(current, 1);
    const daysInRange = differenceInCalendarDays(
      nextMonth > endDate.value ? endDate.value : nextMonth, 
      current
    );
    ticks.push({
      date: current,
      label: format(current, 'MMM'),
      yearLabel: format(current, 'yyyy'),
      isFirstOfYear: current.getMonth() === 0,
      left: dayOffset * state.dayWidth,
      width: daysInRange * state.dayWidth,
    });
    current = nextMonth;
  }
  return ticks;
});

// Top row labels (months for day/week, years for month)
const topLabels = computed(() => {
  if (scaleMode.value === 'month') {
    // Group by year
    const years = new Map();
    monthTicks.value.forEach(t => {
      const y = t.date.getFullYear();
      if (!years.has(y)) years.set(y, { label: t.yearLabel, left: t.left });
    });
    return Array.from(years.values());
  }
  // For day/week mode, show month labels 
  const source = scaleMode.value === 'day' ? dayTicks.value : weekTicks.value;
  const months = [];
  let lastMonth = null;
  source.forEach(t => {
    const key = format(t.date, 'yyyy-MM');
    if (key !== lastMonth) {
      months.push({ label: format(t.date, 'MMM yyyy'), left: t.left });
      lastMonth = key;
    }
  });
  return months;
});

// Bottom row ticks
const bottomTicks = computed(() => {
  if (scaleMode.value === 'day') return dayTicks.value;
  if (scaleMode.value === 'week') return weekTicks.value;
  return monthTicks.value;
});

// Drag-to-zoom
let dragStartX = 0;
let initialDayWidth = 0;

const onPointerDown = (e) => {
  e.stopPropagation();
  e.target.setPointerCapture(e.pointerId);
  dragStartX = e.clientX;
  initialDayWidth = state.dayWidth;
  
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
};

const onPointerMove = (e) => {
  const deltaX = e.clientX - dragStartX;
  const newWidth = initialDayWidth + (deltaX * 0.5);
  state.dayWidth = Math.max(2, Math.min(100, newWidth));
};

const onPointerUp = () => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
};
</script>

<template>
  <div 
    class="timeline-header" 
    :style="{ width: `${chartWidth}px`, cursor: 'col-resize' }"
    @pointerdown="onPointerDown"
  >
    <div class="today-marker" :style="{ left: `${todayMiddle}px` }"></div>
    <!-- Top row: month or year labels -->

    <div class="top-row">
      <div 
        v-for="(item, i) in topLabels" 
        :key="`top-${i}`"
        class="top-label"
        :style="{ left: `${item.left}px` }"
      >
        {{ item.label }}
      </div>
    </div>

    <!-- Bottom row: day / week / month ticks -->
    <div class="bottom-row">
      <div 
        v-for="(tick, i) in bottomTicks" 
        :key="`btm-${i}`" 
        class="tick-label"
        :style="{ width: `${tick.width}px` }"
      >
        {{ tick.label }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-header {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.top-row {
  height: 18px;
  position: relative;
  border-bottom: 1px solid var(--color-grid);
}
.top-label {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  padding-left: 8px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}
.bottom-row {
  flex: 1;
  display: flex;
}
.tick-label {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  border-right: 1px solid var(--color-grid);
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
}
.today-marker {
  position: absolute;
  bottom: -4px; /* Sit on the lower border */
  width: 8px;
  height: 8px;
  background-color: var(--color-today);
  border-radius: 50%;
  transform: translateX(-50%);
  z-index: 100; /* High enough to be on top */
  pointer-events: none;
}

</style>
