import { formatDate, str2date } from './utils.ts'
import { intervalToDuration } from 'date-fns'

const taskJsonUrl = import.meta.env.VITE_TASK_JSON_URL;

/**
 * Representation of a task as we will receive it from an API call.
 */
interface TaskJson {
    description: string;
    due?: string;
    project: string;
    status: string;
    urgency: number;
}

/**
 * Internal representation of a task.
 */
class Task {
    description: string;
    due?: Date;
    project: string;
    status: string;
    urgency: number;

    /**
     * Creates a new Task instance.
     *
     * @param description - The task's description.
     * @param due - The due date as a compact string (it will be converted to a JavaScript Date object).
     * @param project - The name of the project that the task belongs to.
     * @param status - The status of the task.
     * @param urgency - The urgency score of the task.
     */
    constructor(description: string, due: string, project: string, status: string, urgency: number) {
        this.description = description;
        this.due = str2date(due);
        this.project = project;
        this.status = status;
        this.urgency = urgency;
    }

    /**
     * Creates a Task instance from a TaskJson object.
     *
     * @param taskJson - The JSON object representing a task.
     *
     * @returns The constructed Task instance.
     */
    static fromJson(taskJson: TaskJson): Task {
        return new Task(
            taskJson.description,
            taskJson.due ?? '',
            taskJson.project,
            taskJson.status,
            taskJson.urgency
        );
    }

    /**
     * Updates the countdown display for the task's due date.
     *
     * Sets the countdown title and text nodes to show either the time remaining
     * until the due date, or the time overdue if the due date has passed. Also
     * updates the taskDiv's CSS class to reflect the task's status (good,
     * neutral, or bad) based on how much time is left or overdue.
     *
     * @param taskDiv - The div representing the task, whose class will be updated.
     * @param countdownTitleText - The text node for the countdown title (will be either "TIME REMAINING:" or "OVERDUE BY:").
     * @param countdownText - The text node for the countdown duration.
     */
    updateTimeRemaining(taskDiv: HTMLDivElement, countdownContainer: HTMLDivElement): void {
        if (!this.due) {
            return;
        }

        const now = new Date();
        const [start, end] = this.due < now ? [this.due, now] : [now, this.due];
        const timeRemaining = intervalToDuration({ start: start, end: end });

        // Build time units array, excluding zero values
        const timeUnits = [];
        
        if (timeRemaining.years && timeRemaining.years > 0) {
            timeUnits.push({ value: timeRemaining.years.toString().padStart(2, '0'), label: 'years' });
        }
        if (timeRemaining.months && timeRemaining.months > 0) {
            timeUnits.push({ value: timeRemaining.months.toString().padStart(2, '0'), label: 'months' });
        }
        if (timeRemaining.days && timeRemaining.days > 0) {
            timeUnits.push({ value: timeRemaining.days.toString().padStart(2, '0'), label: 'days' });
        }
        if (timeRemaining.hours && timeRemaining.hours > 0) {
            timeUnits.push({ value: timeRemaining.hours.toString().padStart(2, '0'), label: 'hours' });
        }
        if (timeRemaining.minutes && timeRemaining.minutes > 0) {
            timeUnits.push({ value: timeRemaining.minutes.toString().padStart(2, '0'), label: 'mins' });
        }
        // Always show seconds
        timeUnits.push({ value: (timeRemaining.seconds || 0).toString().padStart(2, '0'), label: 'secs' });

        // Build HTML
        const unitsHTML = timeUnits.map((unit, index) => `
            ${index > 0 ? '<div class="time-separator">:</div>' : ''}
            <div class="time-unit">
                <div class="time-value">${unit.value}</div>
                <div class="time-label">${unit.label}</div>
            </div>
        `).join('');

        countdownContainer.innerHTML = `
            <p class="countdown-title">${this.due > now ? 'TIME REMAINING:' : 'OVERDUE BY:'}</p>
            <div class="countdown-display">
                ${unitsHTML}
            </div>
        `;

        taskDiv.classList.remove('good', 'bad', 'neutral');
        if (this.due < now) {
            taskDiv.classList.add('bad');
        } else {
            if (timeRemaining.years && timeRemaining.years > 0) {
                taskDiv.classList.add('good');
            } else if (timeRemaining.months && timeRemaining.months > 0) {
                taskDiv.classList.add('good');
            } else if (!timeRemaining.days || timeRemaining.days <= 1) {
                taskDiv.classList.add('neutral');
            } else {
                taskDiv.classList.add('good');
            }
        }
    }

    /**
     * Converts the Task instance to an HTMLDivElement for rendering.
     *
     * @returns The HTML representation of the task.
     */
    toHtml(): HTMLDivElement {
        const taskDiv = document.createElement('div');
        taskDiv.classList.add('task');

        const detailsDiv = document.createElement('div');
        detailsDiv.classList.add('task-details')

        const descriptionH3 = document.createElement('h3');
        const descriptionText = document.createTextNode(this.description)
        descriptionH3.appendChild(descriptionText);
        detailsDiv.appendChild(descriptionH3);

        const dueP = document.createElement('p');
        const dueStrong = document.createElement('strong');
        const dueStrongText = document.createTextNode('Due: ');
        dueStrong.appendChild(dueStrongText);
        dueP.appendChild(dueStrong);
        const dueText = (this.due)
            ? document.createTextNode(formatDate(this.due))
            : document.createTextNode('No due date');
        dueP.appendChild(dueText);
        detailsDiv.appendChild(dueP);

        const projectP = document.createElement('p');
        const projectStrong = document.createElement('strong');
        const projectStrongText = document.createTextNode('Project: ');
        projectStrong.appendChild(projectStrongText);
        projectP.appendChild(projectStrong);
        const projectText =  document.createTextNode(this.project);
        projectP.appendChild(projectText);
        detailsDiv.appendChild(projectP);

        const statusP = document.createElement('p');
        const statusStrong = document.createElement('strong');
        const statusStrongText = document.createTextNode('Status: ');
        statusStrong.appendChild(statusStrongText);
        statusP.appendChild(statusStrong);
        const statusText =  document.createTextNode(this.status);
        statusP.appendChild(statusText);
        detailsDiv.appendChild(statusP);

        const urgencyP = document.createElement('p');
        const urgencyStrong = document.createElement('strong');
        const urgencyStrongText = document.createTextNode('Urgency: ');
        urgencyStrong.appendChild(urgencyStrongText);
        urgencyP.appendChild(urgencyStrong);
        const urgencyText = document.createTextNode(`Urgency: ${this.urgency.toFixed(2)}`);
        urgencyP.appendChild(urgencyText);
        detailsDiv.appendChild(urgencyP);

        const countdownDiv = document.createElement('div');
        const countdownTitleP = document.createElement('p');
        countdownTitleP.classList.add('countdown-title')
        const countdownTitleText = document.createTextNode('');
        const countdownP = document.createElement('p');
        countdownP.classList.add('countdown-text')
        const countdownText = document.createTextNode('');
        countdownTitleP.appendChild(countdownTitleText);
        countdownP.appendChild(countdownText);
        countdownDiv.appendChild(countdownTitleP);
        countdownDiv.appendChild(countdownP);
        detailsDiv.appendChild(countdownDiv)

        // Set the time remaining text
        this.updateTimeRemaining(taskDiv, countdownDiv);

        // Make sure the time remaining text keeps updating
        setInterval(() => { this.updateTimeRemaining(taskDiv, countdownDiv) }, 1000);

        taskDiv.appendChild(detailsDiv);

        return taskDiv;
    }
}

/**
 * Renders an array of Task objects into the DOM, sorted by urgency.
 *
 * @param tasks - The array of Task objects to render.
 *
 * @throws Will throw an error if the task list element is not found.
 */
function renderTasks(tasks: Task[]) {
    const taskList = document.getElementById('task-list');
    if (!taskList) {
        throw Error('Task list is null');
    }
    tasks
        .sort((a, b) => b.urgency - a.urgency)
        .forEach(task => taskList.appendChild(task.toHtml()));
}

/**
 * Fetches tasks from the configured JSON URL and renders them to the DOM.
 * Alerts and logs errors if the fetch operation fails.
 *
 * @returns A promise that resolves when tasks are fetched and rendered.
 */
export async function fetchTasks(): Promise<void> {
    try {
        const response = await fetch(taskJsonUrl);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const tasksJson: TaskJson[] = await response.json();
        const tasks = tasksJson.map(Task.fromJson);
        renderTasks(tasks);
    } catch (error) {
        alert(error)
        console.error(
            'There was a problem with the fetch operation:',
            error
        );
    }
}
