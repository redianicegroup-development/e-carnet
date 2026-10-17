FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# requirements.txt est le fichier verrouillé (make lock) : dès qu'il porte des empreintes, pip refuse tout paquet non listé ou modifié.
COPY apps/api/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY apps/api/ /app/
RUN DJANGO_DEBUG=true python manage.py collectstatic --noinput \
    && test -f /app/staticfiles/admin/css/base.css \
    && test -f /app/staticfiles/admin/js/theme.js

EXPOSE 8000
# Render builds this Dockerfile; CMD is the start command. Admin creation is a no-op unless both env vars are set.
CMD ["sh", "-c", "python manage.py migrate --noinput && (python manage.py cleanup_visitor_analytics --retention-days 90 || echo 'WARNING: visitor analytics cleanup failed.') && (python manage.py bootstrap_admin --if-configured || echo 'WARNING: admin bootstrap failed; starting API without creating an admin account.') && exec gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --threads 4 --timeout 120 --error-logfile - --log-level info --capture-output --access-logfile - --access-logformat '%(m)s %(U)s %(s)s %(L)s'"]
