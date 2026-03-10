import { reactive, computed } from 'vue';
import { addDays, differenceInCalendarDays, subWeeks, subDays, addWeeks, startOfWeek, format, differenceInWeeks, differenceInMonths, addMonths, startOfMonth } from 'date-fns';
import { barColors } from './colors';

// Create a unique ID generator
const uid = () => Math.random().toString(36).substr(2, 9);

const today = new Date();

// Initial state
const state = reactive({
    groups: [
        {
            id: uid(),
            name: 'Strategy',
            color: barColors[0],
            tasks: [
                // Note: JavaScript months are 0-indexed (Jan=0, Feb=1, Mar=2, etc.)
                { id: uid(), title: 'Planning', start: subDays(today, 21), end: subDays(today, 15), progress: 90 },
                { id: uid(), title: 'Presentation', start: subDays(today, 14), end: subDays(today, 2), progress: 80 },
                { id: uid(), title: 'Approval', start: today, end: addDays(today, 5), progress: 25 }
            ]
        },
        {
            id: uid(),
            name: 'Design & Branding',
            color: barColors[1],
            tasks: [
                { id: uid(), title: 'Moodboard', start: addDays(today, 5), end: addDays(today, 12), progress: 40 },
                { id: uid(), title: 'Concept', start: addDays(today, 10), end: addDays(today, 15), progress: 35 }
            ]
        },
        {
            id: uid(),
            name: 'Adoption',
            color: barColors[3],
            tasks: [
                { id: uid(), title: 'Survey', start: addDays(today, 10), end: addDays(today, 20), progress: 40 },
            ]
        }
    ],
    startDate: subDays(today, 21),
    dayWidth: 30,
    chartTitle: 'My Gantt',
    viewportWidth: window.innerWidth, // set by GanttChart on mount/resize
    chartContainer: null, // set by GanttChart on mount
    draggingMaxDay: null,
    draggingMinDay: null,
});


const contextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    targetType: null, // 'task', 'group', 'chart'
    targetId: null,
    parentGroupId: null
});

export function useGantt() {

    const totalDays = computed(() => {
        const sidebarWidth = 220;
        const visibleChartWidth = state.viewportWidth - sidebarWidth;
        const daysToFill = Math.ceil(visibleChartWidth / state.dayWidth);

        // Left-most date in viewport


        let maxDay = 30; // default minimum
        let minDay = 1; // default maximum

        // Ensure we account for all tasks in all groups
        if (state.groups) {
            state.groups.forEach(group => {
                if (group.tasks) {
                    group.tasks.forEach(task => {
                        if (task.end) {
                            const day = differenceInCalendarDays(new Date(task.end), state.startDate) + 1;
                            if (day > maxDay) maxDay = day;
                        }
                    });
                }
            });

            const todayDay = differenceInCalendarDays(today, state.startDate) + 1;
            if (todayDay > maxDay) maxDay = todayDay;

            if (state.draggingMaxDay !== null && state.draggingMaxDay > maxDay) {
                maxDay = state.draggingMaxDay;
            }

            if (state.draggingMinDay !== null && state.draggingMinDay < minDay) {
                minDay = state.draggingMinDay;
            }
        }
        // Return max of what's needed to fill viewport vs what's needed for content
        return Math.max(daysToFill, maxDay) + 7; // Buffer on the right edge
    });

    const endDate = computed(() => addDays(state.startDate, totalDays.value - 1));
    const chartWidth = computed(() => totalDays.value * state.dayWidth);
    const today = new Date(); // Using current local time from metadata
    const todayLeft = computed(() => differenceInCalendarDays(today, state.startDate) * state.dayWidth);
    const todayMiddle = computed(() => todayLeft.value + state.dayWidth * (today.getHours() / 24));

    const getTaskLeft = (start) => (differenceInCalendarDays(start, state.startDate) - 0) * state.dayWidth;
    const getTaskWidth = (start, end) => (differenceInCalendarDays(end, start) + 1) * state.dayWidth;
    const dateFromLeft = (left) => addDays(state.startDate, Math.round(left / state.dayWidth));

    const getViewportStartDate = () => {
        const scrollLeft = state.chartContainer?.scrollLeft ?? 0;
        return dateFromLeft(scrollLeft);
    };

    const findGroupForTask = (taskId) => {
        return state.groups.find(g => g.tasks.some(t => t.id === taskId));
    };

    // Actions
    const openContextMenu = (e, type, id = null) => {
        e.preventDefault();
        contextMenu.visible = true;
        contextMenu.x = e.clientX;
        contextMenu.y = e.clientY;
        contextMenu.targetType = type;
        contextMenu.targetId = id;
        // If the target is a task, also store the parent group id
        if (type === 'task') {
            const parentGroup = findGroupForTask(id);
            contextMenu.parentGroupId = parentGroup ? parentGroup.id : null;
        } else {
            contextMenu.parentGroupId = null;
        }
    };

    const closeContextMenu = () => {
        contextMenu.visible = false;
    };

    const addGroup = () => {
        state.groups.push({
            id: uid(),
            name: 'New Group',
            color: barColors[Math.floor(Math.random() * barColors.length)], // A newly created group gets a random color
            tasks: []
        });
    };

    const removeGroup = (id) => {
        state.groups = state.groups.filter(g => g.id !== id);
    };

    const insertGroupAfter = (id) => {
        const newGroup = {
            id: uid(),
            name: 'New Group',
            color: barColors[Math.floor(Math.random() * barColors.length)],
            tasks: []
        };
        const idx = state.groups.findIndex(g => g.id === id);
        if (idx === -1) {
            state.groups.push(newGroup); // fallback: append
        } else {
            state.groups.splice(idx + 1, 0, newGroup);
        }
    };

    const addTask = (groupId) => {
        const group = state.groups.find(g => g.id === groupId);
        if (group) {
            const start = getViewportStartDate();
            group.tasks.push({
                id: uid(),
                title: 'New Task',
                start: start, // always spawn at the left viewport border
                end: addDays(start, 5),
                progress: 0
            });
        }
    };

    const removeTask = (taskId) => {
        state.groups.forEach(group => {
            group.tasks = group.tasks.filter(t => t.id !== taskId);
        });
    };

    const changeGroupColor = (groupId, color) => {
        const group = state.groups.find(g => g.id === groupId);
        if (group) group.color = color;
    };

    // Timeline zoom
    const zoomIn = () => {
        state.dayWidth = Math.min(100, state.dayWidth + 5);
    };

    const saveProject = () => {
        const data = JSON.stringify(state, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.chartTitle || 'gantt-project'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const loadProject = (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            // Deep merge/update state
            if (data.groups) state.groups = data.groups;
            if (data.startDate) state.startDate = new Date(data.startDate);
            if (data.endDate) state.endDate = new Date(data.endDate);
            if (data.dayWidth) state.dayWidth = data.dayWidth;
            if (data.chartTitle) state.chartTitle = data.chartTitle;
            if (data.sidebarWidth) state.sidebarWidth = data.sidebarWidth;
        } catch (e) {
            console.error('Failed to load project:', e);
            alert('Failed to load project. Invalid JSON format.');
        }
    };

    const exportToSVG = () => {
        const rowHeight = 38; // --row-height: 32px
        const timelineHeight = 36; // Height for timeline header
        const sidebarWidth = 0;//220; // Width for sidebar

        let totalRows = 0;
        state.groups.forEach(g => {
            totalRows += 1; // group header
            totalRows += g.tasks.length; // tasks
        });
        const chartHeight = totalRows * rowHeight;
        const totalHeight = timelineHeight + chartHeight;
        const totalWidth = sidebarWidth + chartWidth.value;

        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`;

        // Background
        svg += `<rect width="100%" height="100%" fill="#ffffff" />`;

        // Sidebar background
        svg += `<rect x="0" y="${timelineHeight}" width="${sidebarWidth}" height="${chartHeight}" fill="#f8fafc" />`;

        // Timeline header background
        svg += `<rect x="${sidebarWidth}" y="0" width="${chartWidth.value}" height="${timelineHeight}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" />`;

        // Generate timeline ticks based on scale
        const scaleMode = state.dayWidth >= 22 ? 'day' : state.dayWidth >= 8 ? 'week' : 'month';

        // Top row labels
        const topLabels = [];
        if (scaleMode === 'month') {
            let current = startOfMonth(state.startDate);
            if (current < state.startDate) current = addMonths(current, 1);
            while (current <= endDate.value) {
                const dayOffset = differenceInCalendarDays(current, state.startDate);
                const y = current.getFullYear();
                if (!topLabels.find(l => l.year === y)) {
                    topLabels.push({ label: y.toString(), left: sidebarWidth + dayOffset * state.dayWidth, year: y });
                }
                current = addMonths(current, 1);
            }
        } else {
            let lastMonth = null;
            for (let i = 0; i < totalDays.value; i++) {
                const d = addDays(state.startDate, i);
                const key = format(d, 'yyyy-MM');
                if (key !== lastMonth) {
                    topLabels.push({ label: format(d, 'MMM yyyy'), left: sidebarWidth + i * state.dayWidth });
                    lastMonth = key;
                }
            }
        }

        // Bottom row ticks
        const bottomTicks = [];
        if (scaleMode === 'day') {
            for (let i = 0; i < totalDays.value; i++) {
                const d = addDays(state.startDate, i);
                bottomTicks.push({
                    label: format(d, 'd'),
                    left: sidebarWidth + i * state.dayWidth,
                    width: state.dayWidth
                });
            }
        } else if (scaleMode === 'week') {
            let current = startOfWeek(state.startDate, { weekStartsOn: 1 });
            if (current < state.startDate) current = addWeeks(current, 1);
            while (current <= endDate.value) {
                const dayOffset = differenceInCalendarDays(current, state.startDate);
                bottomTicks.push({
                    label: format(current, 'MMM d'),
                    left: sidebarWidth + dayOffset * state.dayWidth,
                    width: 7 * state.dayWidth
                });
                current = addWeeks(current, 1);
            }
        } else {
            let current = startOfMonth(state.startDate);
            if (current < state.startDate) current = addMonths(current, 1);
            while (current <= endDate.value) {
                const dayOffset = differenceInCalendarDays(current, state.startDate);
                const nextMonth = addMonths(current, 1);
                const daysInRange = differenceInCalendarDays(
                    nextMonth > endDate.value ? endDate.value : nextMonth,
                    current
                );
                bottomTicks.push({
                    label: format(current, 'MMM'),
                    left: sidebarWidth + dayOffset * state.dayWidth,
                    width: daysInRange * state.dayWidth
                });
                current = nextMonth;
            }
        }

        // Draw top labels
        topLabels.forEach(label => {
            svg += `<text x="${label.left + 8}" y="14" font-family="Arial, sans-serif" font-size="11" font-weight="600" fill="#374151">${label.label}</text>`;
        });

        // Draw bottom ticks
        bottomTicks.forEach(tick => {
            svg += `<line x1="${tick.left}" y1="${timelineHeight - 18}" x2="${tick.left}" y2="${timelineHeight}" stroke="#e5e7eb" stroke-width="1" />`;
            svg += `<text x="${tick.left + tick.width / 2}" y="${timelineHeight - 4}" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#6b7280">${tick.label}</text>`;
        });

        // Grid lines (vertical)
        for (let i = 0; i <= totalDays.value; i++) {
            const x = sidebarWidth + i * state.dayWidth;
            svg += `<line x1="${x}" y1="${timelineHeight}" x2="${x}" y2="${totalHeight}" stroke="#f3f4f6" stroke-width="1" />`;
        }

        // Grid lines (horizontal)
        let currentY = timelineHeight;
        state.groups.forEach(group => {
            currentY += rowHeight; // group header
            group.tasks.forEach(() => {
                svg += `<line x1="${sidebarWidth}" y1="${currentY}" x2="${totalWidth}" y2="${currentY}" stroke="#f3f4f6" stroke-width="1" />`;
                currentY += rowHeight;
            });
            svg += `<line x1="${sidebarWidth}" y1="${currentY}" x2="${totalWidth}" y2="${currentY}" stroke="#f3f4f6" stroke-width="1" />`;
        });
        // Bottom line
        svg += `<line x1="${sidebarWidth}" y1="${currentY}" x2="${totalWidth}" y2="${currentY}" stroke="#f3f4f6" stroke-width="1" />`;

        // Draw groups and tasks
        currentY = timelineHeight;
        state.groups.forEach(group => {
            // Group row background
            svg += `<rect x="0" y="${currentY}" width="${totalWidth}" height="${rowHeight}" fill="#f8fafc" opacity="0.5" />`;
            
            // Group header
            svg += `<rect x="0" y="${currentY}" width="${sidebarWidth}" height="${rowHeight}" fill="#f8fafc" stroke="#e5e7eb" stroke-width="1" />`;
            svg += `<rect x="12" y="${currentY + 14}" width="10" height="10" fill="${group.color}" rx="2" />`;
            const escapedGroupName = group.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            svg += `<text x="30" y="${currentY + 24}" font-family="Arial, sans-serif" font-size="13" font-weight="600" fill="#374151">${escapedGroupName}</text>`;

            currentY += rowHeight;

            // Tasks
            group.tasks.forEach(task => {
                // Task row background
                svg += `<rect x="0" y="${currentY}" width="${sidebarWidth}" height="${rowHeight}" fill="#ffffff" stroke="#e5e7eb" stroke-width="1" />`;

                // Task title in sidebar
                const escapedTaskTitle = task.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                //svg += `<text x="12" y="${currentY + 26}" font-family="Arial, sans-serif" font-size="12" fill="#6b7280">${escapedTaskTitle}</text>`;

                // Task bar
                const taskLeft = sidebarWidth + getTaskLeft(task.start);
                const taskWidth = getTaskWidth(task.start, task.end);
                const taskHeight = 28;
                const taskY = currentY + 5;

                // Background bar
                svg += `<rect x="${taskLeft}" y="${taskY}" width="${taskWidth}" height="${taskHeight}" fill="${group.color}" opacity="0.3" rx="4" />`;

                // Progress fill
                const progressWidth = (task.progress / 100) * taskWidth;
                if (progressWidth > 0) {
                    svg += `<rect x="${taskLeft}" y="${taskY}" width="${progressWidth}" height="${taskHeight}" fill="${group.color}" rx="4" />`;
                }

                // Task title on bar
                svg += `<text x="${taskLeft + 8}" y="${taskY + 18}" font-family="Arial, sans-serif" font-size="12" fill="white" font-weight="bold">${escapedTaskTitle}</text>`;

                currentY += rowHeight;
            });
        });

        svg += '</svg>';

        // Download
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.chartTitle || 'gantt-chart'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const zoomOut = () => {
        state.dayWidth = Math.max(2, state.dayWidth - 5);
    };

    const shiftStartDate = (days) => {
        const offset = days * state.dayWidth;
        state.startDate = subDays(state.startDate, days);
        if (state.chartContainer) {
            state.chartContainer.scrollLeft += offset;
        }
    };

    return {
        state,
        contextMenu,
        totalDays,
        chartWidth,
        endDate,
        getTaskLeft,
        getTaskWidth,
        dateFromLeft,
        uid,
        findGroupForTask,
        openContextMenu,
        closeContextMenu,
        addGroup,
        removeGroup,
        insertGroupAfter,
        addTask,
        removeTask,
        changeGroupColor,
        zoomIn,
        zoomOut,
        shiftStartDate,
        saveProject,
        loadProject,
        exportToSVG,
        todayLeft,
        todayMiddle,
        chartContainer: computed({
            get: () => state.chartContainer,
            set: (val) => { state.chartContainer = val; }
        }),
        jumpToToday: (container) => {
            if (container) {
                const scrollX = todayMiddle.value - (container.clientWidth / 2);
                container.scrollTo({ left: scrollX, behavior: 'smooth' });
            }
        },
        jumpToStart: (container) => {
            if (container) {
                container.scrollTo({ left: 0, behavior: 'smooth' })
            }
        },
        jumpToEnd: (container) => {
            if (container) {
                container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' })
            }
        }
    };
}

