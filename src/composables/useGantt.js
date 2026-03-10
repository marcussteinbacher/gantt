import { reactive, computed } from 'vue';
import { addDays, differenceInCalendarDays, subWeeks, subDays } from 'date-fns';
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

