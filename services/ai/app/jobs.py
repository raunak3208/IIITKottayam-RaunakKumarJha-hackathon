import collections
import os
import subprocess
import threading
from datetime import datetime, timezone

COMMANDS = {
    "evaluate": ["python", "-m", "eval.run_all"],
    "load_test": ["python", "-m", "eval.load_test"],
    "train_classifier": ["python", "-m", "app.training.train_event_head"],
    "build_reactions": ["python", "-m", "app.retrieval.build_reactions"],
}
TAIL = 40


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class JobRunner:
    def __init__(self, engine=None, on_success=None, commands=None):
        self.engine = engine
        self.commands = commands or COMMANDS
        self.on_success = on_success
        self.lock = threading.Lock()
        self.jobs = {
            name: {
                "status": "idle",
                "started": None,
                "finished": None,
                "exit_code": None,
                "lines": collections.deque(maxlen=200),
            }
            for name in self.commands
        }

    def start(self, name):
        if name not in self.commands:
            raise KeyError(name)
        with self.lock:
            if any(job["status"] == "running" for job in self.jobs.values()):
                raise RuntimeError("another job is running")
            job = self.jobs[name]
            job.update(status="running", started=_now(), finished=None, exit_code=None)
            job["lines"].clear()
        threading.Thread(target=self._run, args=(name,), daemon=True).start()

    def _run(self, name):
        job = self.jobs[name]
        try:
            if name == "evaluate" and self.engine is not None:
                import io
                import sys
                import eval.run_all

                class CaptureLog:
                    def write(self, s):
                        for line in s.splitlines():
                            if line.strip():
                                job["lines"].append(line.strip())
                    def flush(self):
                        pass

                cap = CaptureLog()
                old_stdout = sys.stdout
                sys.stdout = cap
                try:
                    eval.run_all.main(self.engine)
                finally:
                    sys.stdout = old_stdout
                code = 0
            else:
                process = subprocess.Popen(
                    self.commands[name],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1,
                    cwd=os.getcwd(),
                )
                for line in process.stdout:
                    job["lines"].append(line.rstrip())
                code = process.wait()
        except Exception as err:
            job["lines"].append(str(err))
            code = -1

        job.update(status="done" if code == 0 else "failed", finished=_now(), exit_code=code)
        if code == 0 and self.on_success:
            try:
                self.on_success(name)
            except Exception as err:
                job["lines"].append(f"reload failed: {err}")

    def snapshot(self):
        return [
            {
                "name": name,
                "status": job["status"],
                "started": job["started"],
                "finished": job["finished"],
                "exit_code": job["exit_code"],
                "tail": list(job["lines"])[-TAIL:],
            }
            for name, job in self.jobs.items()
        ]
