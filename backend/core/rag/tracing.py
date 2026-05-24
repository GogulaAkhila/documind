"""Pipeline observability — per-stage tracing with timing, scores, and counts."""
import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class StageTrace:
    name: str
    latency_ms: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineTrace:
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    stages: list[StageTrace] = field(default_factory=list)
    total_latency_ms: float = 0.0
    _start_time: float = field(default=0.0, repr=False)

    def start(self) -> None:
        self._start_time = time.perf_counter()

    def finish(self) -> None:
        if self._start_time:
            self.total_latency_ms = round((time.perf_counter() - self._start_time) * 1000, 1)

    @contextmanager
    def stage(self, name: str):
        """Context manager for timing a pipeline stage."""
        stage_start = time.perf_counter()
        meta: dict[str, Any] = {}
        yield meta
        elapsed = round((time.perf_counter() - stage_start) * 1000, 1)
        self.stages.append(StageTrace(name=name, latency_ms=elapsed, metadata=meta))

    def to_dict(self) -> dict[str, Any]:
        return {
            "trace_id": self.trace_id,
            "total_latency_ms": self.total_latency_ms,
            "stages": {
                s.name: {"latency_ms": s.latency_ms, **s.metadata}
                for s in self.stages
            },
        }

    def log_summary(self) -> None:
        stage_summary = ", ".join(
            f"{s.name}={s.latency_ms}ms" for s in self.stages
        )
        logger.info(
            "Pipeline trace",
            extra={
                "trace_id": self.trace_id,
                "total_ms": self.total_latency_ms,
                "stages": stage_summary,
            },
        )
