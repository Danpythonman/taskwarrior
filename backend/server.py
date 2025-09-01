import subprocess
import json
import signal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


CMD = ['task', 'status:pending', 'export']

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get('/tasks')
def data():
    cp = subprocess.run(
        CMD,
        capture_output=True,
        text=True,
        timeout=5
    )
    rc = cp.returncode

    if rc < 0:
        sig = signal.Signals(-rc).name
        raise HTTPException(status_code=502, detail=f'task export crashed: {sig}')

    if rc != 0:
        err = (cp.stderr or '').strip()
        raise HTTPException(status_code=502, detail=f'task export failed rc={rc}: {err}')

    try:
        return JSONResponse(content=json.loads(cp.stdout))
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail='task export generated invalid JSON')
