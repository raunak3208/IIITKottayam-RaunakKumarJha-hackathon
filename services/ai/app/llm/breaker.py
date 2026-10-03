import time


class CircuitOpen(Exception):
    pass


class CircuitBreaker:
    def __init__(self, threshold=3, cooldown=30.0, clock=time.monotonic):
        self.threshold = threshold
        self.cooldown = cooldown
        self.clock = clock
        self.failures = 0
        self.opened_at = None

    @property
    def state(self):
        if self.opened_at is None:
            return "closed"
        return "half_open" if self.clock() - self.opened_at >= self.cooldown else "open"

    def before(self):
        if self.state == "open":
            raise CircuitOpen()

    def success(self):
        self.failures = 0
        self.opened_at = None

    def failure(self):
        trial_failed = self.state == "half_open"
        self.failures += 1
        if trial_failed or self.failures >= self.threshold:
            self.opened_at = self.clock()
