import { formatDate, str2date } from './utils.ts'
import { formatDuration, intervalToDuration } from 'date-fns'

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
     * Updates the given HTML element with the time remaining or overdue for the
     * task. Adds appropriate CSS classes for styling.
     *
     * @param element - The HTML element to update.
     */
    updateTimeRemaining(element: HTMLElement): void {
        if (!this.due) {
            return;
        }
        const now = new Date();
        const timeRemaining = intervalToDuration({ start: this.due, end: now });
        const timeRemainingText = formatDuration(timeRemaining);
        if (this.due > now) {
            element.innerText = `${timeRemainingText} remaining`;
            element.classList.add('duration-remaining');
            element.classList.remove('duration-overdue');
        } else {
            element.innerText = `${timeRemainingText} overdue`;
            element.classList.add('duration-overdue');
            element.classList.remove('duration-remaining');
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
        if (this.due) {
            const dueText =  document.createTextNode(formatDate(this.due));
            dueP.appendChild(dueText);

            const remainingP = document.createElement('p');

            // Set the time remaining text
            this.updateTimeRemaining(remainingP)

            // Make sure the time remaining text keeps updating
            setInterval(() => { this.updateTimeRemaining(remainingP) }, 1000);

            detailsDiv.appendChild(dueP);
            detailsDiv.appendChild(remainingP);
        } else {
            const dueText =  document.createTextNode('No due date');
            dueP.appendChild(dueText);
            detailsDiv.appendChild(dueP);
        }

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

        taskDiv.appendChild(detailsDiv);

        const urgencyDiv = document.createElement('div');
        urgencyDiv.classList.add('urgency');

        const urgencyText = document.createTextNode(`Urgency: ${this.urgency.toFixed(2)}`);
        urgencyDiv.appendChild(urgencyText);

        taskDiv.appendChild(urgencyDiv);

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
