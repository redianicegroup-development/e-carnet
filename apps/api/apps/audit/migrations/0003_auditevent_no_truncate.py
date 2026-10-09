from django.db import migrations


def install_truncate_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    table = schema_editor.quote_name("audit_auditevent")
    function = schema_editor.quote_name("audit_event_reject_mutation")
    trigger = schema_editor.quote_name("audit_event_no_truncate")
    schema_editor.execute(
        f"""CREATE TRIGGER {trigger}
        BEFORE TRUNCATE ON {table}
        FOR EACH STATEMENT EXECUTE FUNCTION {function}();"""
    )


def remove_truncate_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    table = schema_editor.quote_name("audit_auditevent")
    trigger = schema_editor.quote_name("audit_event_no_truncate")
    schema_editor.execute(f"DROP TRIGGER IF EXISTS {trigger} ON {table};")


class Migration(migrations.Migration):
    dependencies = [("audit", "0002_auditevent_append_only")]

    operations = [
        migrations.RunPython(install_truncate_trigger, remove_truncate_trigger),
    ]
