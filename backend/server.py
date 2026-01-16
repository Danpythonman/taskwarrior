'''
Backend server for exposing TaskWarrior tasks over HTTP.

Provides two endpoints: `/tasks` which returns raw TaskWarrior
export output and `/gpt/tasks` which returns an enhanced task
representation suitable for downstream processing.
'''

from __future__ import annotations
from datetime import datetime, timezone
import json
from operator import attrgetter
import signal
import subprocess
import typing
from typing import Dict, List, Literal, Optional, TypedDict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from jinja2 import Environment, select_autoescape
from pydantic import BaseModel


DATETIME_FORMAT = '%Y%m%dT%H%M%SZ'
'''Format for the datetime strings in the raw tasks.'''


class TaskRaw(TypedDict, total=False):
    '''
    Representation of a task exported directly from TaskWarrior.
    '''

    id: Optional[int]
    '''Unique identifier of the task.'''

    description: Optional[str]
    '''Description of the task.'''

    due: Optional[str]
    '''Due datetime of the task as a string in format `DATETIME_FORMAT`.'''

    entry: Optional[str]
    '''Entry datetime of the task as a string in format `DATETIME_FORMAT`.'''

    modified: Optional[str]
    '''Last modified datetime of the task as a string in format `DATETIME_FORMAT`.'''

    priority: Optional[str]
    '''Priority of the task: either high ('H'), medium ('M'), or low ('L').'''

    project: Optional[str]
    '''Name of the project that this task is associated with.'''

    status: Optional[str]
    '''Status of the task. Should be 'pending' for all of them.'''

    uuid: Optional[str]
    '''UUID for the task.'''

    urgency: Optional[float]
    '''Urgency number of the task, computed by TaskWarrior. Higher number means higher urgency.'''


class IncorrectDateFormatException(Exception):
    '''
    Exception representing the case where `datetime.strptime` tries parsing a
    string with an unexpected format.
    '''

    def __init__(self, value):
        super().__init__(
            f'Expected date string with format \'{DATETIME_FORMAT}\' but got \'{value}\''
        )


class TimeDiffModel(BaseModel):
    '''
    Representation of a difference between two datetimes.

    Fields represent the time delta broken into `days`, `hours`, and
    `minutes` for easier consumption by clients.
    '''

    SECONDS_PER_MINUTE : typing.ClassVar[int] = 60
    MINUTES_PER_HOUR   : typing.ClassVar[int] = 60
    HOURS_PER_DAY      : typing.ClassVar[int] = 24
    SECONDS_PER_HOUR   : typing.ClassVar[int] = SECONDS_PER_MINUTE * MINUTES_PER_HOUR
    SECONDS_PER_DAY    : typing.ClassVar[int] = SECONDS_PER_HOUR * HOURS_PER_DAY

    days    : int = 0
    hours   : int = 0
    minutes : int = 0

    @staticmethod
    def diff(dt1: datetime, dt2: datetime) -> TimeDiffModel:
        '''
        Compute the absolute difference between two datetimes.

        Args:
            dt1: First datetime to compare.
            dt2: Second datetime to compare.

        Returns:
            A `TimeDiff` mapping with keys `days`, `hours`, and `minutes`.
        '''

        if dt1 > dt2:
            delta = dt1 - dt2
        else:
            delta = dt2 - dt1

        total_seconds = int(delta.total_seconds())

        days, remainder  = divmod(total_seconds , TimeDiffModel.SECONDS_PER_DAY   )
        hours, remainder = divmod(remainder     , TimeDiffModel.SECONDS_PER_HOUR  )
        minutes, _       = divmod(remainder     , TimeDiffModel.SECONDS_PER_MINUTE)

        return TimeDiffModel(
            days    = days    ,
            hours   = hours   ,
            minutes = minutes ,
        )


class TaskImprovedModel(BaseModel):
    '''
    Improved task representation derived from `TaskRaw`.

    This contains parsed and normalized fields suitable for JSON
    responses, including ISO-8601 `due` datetimes and computed
    `due_in` / `overdue_by` time differences.
    '''

    PRIORITY_MAP: typing.ClassVar[Dict[str, str]] = {'H': 'HIGH', 'M': 'MEDIUM', 'L': 'LOW'}

    description : str                                        = ''
    status      : str                                        = 'pending'
    priority    : Optional[Literal['HIGH', 'MEDIUM', 'LOW']] = None
    project     : Optional[str]                              = None
    due         : Optional[datetime]                         = None
    due_in      : Optional[TimeDiffModel]                    = None
    overdue_by  : Optional[TimeDiffModel]                    = None
    urgency     : Optional[float]                            = 0.0

    @staticmethod
    def from_raw(raw_task: TaskRaw) -> TaskImprovedModel:
        '''
        Creates a task from a raw TaskWarrior task.

        Args:
            raw_task: The raw TaskWarrior task.

        Returns:
            The improved task representation.
        '''

        description = raw_task.get('description') or ''
        status = raw_task.get('status') or 'pending'
        urgency = raw_task.get('urgency') or 0.0
        project = raw_task.get('project')
        priority = TaskImprovedModel.PRIORITY_MAP.get(raw_task.get('priority'))

        due = None
        due_in = None
        overdue_by = None

        due_str = raw_task.get('due')
        if due_str:
            try:
                due = datetime.strptime(due_str, DATETIME_FORMAT).replace(tzinfo=timezone.utc)
            except ValueError:
                raise IncorrectDateFormatException(due_str)

            now = datetime.now(timezone.utc)
            time_diff = TimeDiffModel.diff(now, due)
            if now > due:
                overdue_by = time_diff
            else:
                due_in = time_diff

        return TaskImprovedModel(
            description = description ,
            status      = status      ,
            priority    = priority    ,
            project     = project     ,
            due         = due         ,
            due_in      = due_in      ,
            overdue_by  = overdue_by  ,
            urgency     = urgency     ,
        )


CMD = ['task', 'status:pending', 'export']
'''Command to export tasks as JSON.'''


def get_raw_tasks() -> List[TaskRaw]:
    '''
    Run the external TaskWarrior export command and parse its JSON.

    Executes the `CMD` configured at the top of the module and
    returns the parsed list of raw task dictionaries. Raises
    `HTTPException` with status 502 if the command fails, crashes,
    or emits invalid JSON, or status 504 if the command times out.

    Returns:
        A list of `TaskRaw` dictionaries as returned by TaskWarrior.
    '''

    try:
        cp = subprocess.run(
            CMD,
            capture_output=True,
            text=True,
            timeout=5
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail='`task export` timed out')
    except FileNotFoundError as e:
        raise HTTPException(status_code=502, detail=f'File not found error: {e}')
    except OSError as e:
        raise HTTPException(status_code=502, detail=f'OS error: {e}')

    rc = cp.returncode

    if rc < 0:
        sig = signal.Signals(-rc).name
        raise HTTPException(status_code=502, detail=f'`task export` crashed: {sig}')

    if rc != 0:
        err = (cp.stderr or '').strip()
        raise HTTPException(status_code=502, detail=f'`task export` failed rc={rc}: {err}')

    try:
        tasks = json.loads(cp.stdout)
        if not isinstance(tasks, list) or not all(isinstance(t, dict) for t in tasks):
            raise HTTPException(status_code=502, detail='`task export` produced unexpected JSON shape')
        return typing.cast(List[TaskRaw], tasks)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail='`task export` generated invalid JSON')


def raw2improved(raw_tasks: List[TaskRaw]) -> List[TaskImprovedModel]:
    '''
    Converts raw tasks to improved tasks.

    Args:
        raw_tasks: The list of raw tasks, which should come from the
            `get_raw_tasks` function.

    Returns:
        Improved tasks in the same order as in the `raw_tasks` list.
    '''
    return [TaskImprovedModel.from_raw(raw_task) for raw_task in raw_tasks]


GPT_TASK_HTML_TEMPLATE = '''
<!DOCTYPE HTML>
<html>
  <body>
    {% for task in tasks %}
      <div class="task">
        <h2>{{ task.description }}</h2>
        <ul>
          <li><strong>Status:</strong> {{ task.status }}</li>
          {% if task.priority %}
            <li><strong>Priority:</strong> {{ task.priority }}</li>
          {% endif %}
          {% if task.project %}
            <li><strong>Project:</strong> {{ task.project }}</li>
          {% endif %}
          {% if task.due %}
            <li><strong>Due:</strong> {{ task.due.strftime("%A, %B %d, %Y at %I:%M %p") }}</li>
          {% endif %}
          {% if task.due_in %}
            <li>
              <strong>Due in:</strong>
              {{ task.due_in['days'] }} days, {{ task.due_in['hours'] }} hours, {{ task.due_in['days'] }} minutes
            </li>
          {% endif %}
          {% if task.overdue_by %}
            <li>
              <strong>Overdue by:</strong>
              {{ task.overdue_by['days'] }} days, {{ task.overdue_by['hours'] }} hours, {{ task.overdue_by['days'] }} minutes
            </li>
          {% endif %}
          {% if task.urgency %}
            <li><strong>Urgency:</strong> {{ task.urgency }}</li>
          {% endif %}
        </ul>
      </div>
      <hr>
    {% endfor %}
  </body>
</html>
'''

jinja_env = Environment(autoescape=select_autoescape())
gpt_task_html_template = jinja_env.from_string(GPT_TASK_HTML_TEMPLATE)


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/tasks')
def tasks():
    '''
    HTTP GET handler returning raw TaskWarrior tasks.

    Returns a JSON response with the command output parsed as a list
    of raw task objects.
    '''

    return JSONResponse(content=get_raw_tasks())


@app.get('/gpt/tasks', response_model=List[TaskImprovedModel])
def gpt_tasks():
    '''
    HTTP GET handler returning enhanced tasks for GPT processing in JSON format.

    Transforms raw TaskWarrior tasks via `Task.from_raw` into a
    normalized structure (ISO datetimes, priority strings, and
    `due_in`/`overdue_by` diffs) and returns them as JSON.
    '''

    raw_tasks = get_raw_tasks()
    try:
        return raw2improved(raw_tasks)
    except IncorrectDateFormatException as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.get('/gpt/html/tasks', response_class=HTMLResponse)
def gpt_tasks_html():
    '''
    HTTP GET handler returning enhanced tasks for GPT processing in HTML format.

    Transforms raw TaskWarrior tasks via `Task.from_raw` into a
    normalized structure (ISO datetimes, priority strings, and
    `due_in`/`overdue_by` diffs) and returns them as HTML.
    '''
    raw_tasks = get_raw_tasks()
    try:
        improved_tasks = sorted(
            raw2improved(raw_tasks),
            key=attrgetter('urgency'),
            reverse=True
        )
        html = gpt_task_html_template.render(
            tasks=improved_tasks,
            now=datetime.now()
        )
        return HTMLResponse(content=html)
    except IncorrectDateFormatException as e:
        raise HTTPException(status_code=502, detail=str(e))
