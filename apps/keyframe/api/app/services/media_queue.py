from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from fastapi import FastAPI

from .media_processing import process_movie_metadata, reset_interrupted_jobs
from .playback import normalize_playback_states
from .scene_processing import process_scene, reset_scene_jobs


def _schedule(
    app: FastAPI,
    task_type: str,
    item_ids: list[int],
    processor: Callable[[int], None],
) -> None:
    for item_id in item_ids:
        key = (task_type, item_id)
        with app.state.queue_lock:
            if key in app.state.queued_tasks:
                continue
            app.state.queued_tasks.add(key)

        def run_and_release(
            current_id: int = item_id,
            current_key: tuple[str, int] = key,
        ) -> None:
            try:
                processor(current_id)
            finally:
                with app.state.queue_lock:
                    app.state.queued_tasks.discard(current_key)

        app.state.media_executor.submit(run_and_release)


def schedule_movies(app: FastAPI, movie_ids: list[int]) -> None:
    _schedule(app, "metadata", movie_ids, process_movie_metadata)


def schedule_scenes(app: FastAPI, scene_ids: list[int]) -> None:
    _schedule(app, "scene", scene_ids, process_scene)


def start_media_queue(app: FastAPI) -> None:
    app.state.media_executor = ThreadPoolExecutor(
        max_workers=1,
        thread_name_prefix="keyframe-media",
    )
    app.state.queue_lock = threading.Lock()
    app.state.queued_tasks = set()
    normalize_playback_states()
    schedule_scenes(app, reset_scene_jobs())
    schedule_movies(app, reset_interrupted_jobs())


def stop_media_queue(app: FastAPI) -> None:
    app.state.media_executor.shutdown(wait=True, cancel_futures=True)
