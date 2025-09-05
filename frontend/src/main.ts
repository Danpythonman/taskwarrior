import { fetchTasks } from './task.ts';
import { restoreTheme, toggleTheme } from './theme.ts'

// Theme-toggle button
const lightBulb = document.getElementById('light-bulb');
if (lightBulb) {
    lightBulb.addEventListener('click', toggleTheme);
} else {
    console.error('Light bulb element not recognized')
}

// Load tasks from server
fetchTasks();

// Restore theme if user previously set a theme
restoreTheme();
