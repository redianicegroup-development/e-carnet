"""Application Celery (phase 2). À copier dans apps/api/config/celery.py — voir README.md."""
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("ecarnet")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
