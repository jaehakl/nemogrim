import threading
from types import SimpleNamespace

from app.services import media_queue


def test_queue_deduplicates_each_task_key_but_allows_other_task_types():
    submitted = []

    class Executor:
        def submit(self, callback):
            submitted.append(callback)

    app = SimpleNamespace(
        state=SimpleNamespace(
            media_executor=Executor(),
            queue_lock=threading.Lock(),
            queued_tasks=set(),
        )
    )
    media_queue.schedule_movies(app, [3, 3])
    media_queue.schedule_movies(app, [3])
    media_queue.schedule_scenes(app, [3, 3])

    assert app.state.queued_tasks == {("metadata", 3), ("scene", 3)}
    assert len(submitted) == 2
