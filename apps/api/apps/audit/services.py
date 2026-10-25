from .models import AuditEvent

ALLOWED_METADATA_KEYS = {"action", "scope", "extension_count", "status", "reason_code", "source_type", "declaration_id", "encounter_id", "membership_id", "invitation_id", "join_code_id", "provider", "resource_type", "resource_count", "resource_id", "authorized_until", "access_duration_minutes"}


def record_event(*, event_type, actor, actor_role, patient=None, establishment=None, access_grant=None, consultation=None, metadata=None):
    safe_metadata = {key: value for key, value in (metadata or {}).items() if key in ALLOWED_METADATA_KEYS}
    return AuditEvent.objects.create(event_type=event_type, actor=actor, actor_role=actor_role, patient=patient, establishment=establishment, access_grant=access_grant, consultation=consultation, metadata=safe_metadata)
