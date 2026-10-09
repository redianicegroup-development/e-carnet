from django.db import migrations, models


def install_append_only_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    table = schema_editor.quote_name("audit_auditevent")
    function = schema_editor.quote_name("audit_event_reject_mutation")
    trigger = schema_editor.quote_name("audit_event_immutable")
    schema_editor.execute(
        f"""CREATE FUNCTION {function}() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'audit events are append-only'
                USING ERRCODE = '55000';
        END;
        $$ LANGUAGE plpgsql;"""
    )
    schema_editor.execute(
        f"""CREATE TRIGGER {trigger}
        BEFORE UPDATE OR DELETE ON {table}
        FOR EACH ROW EXECUTE FUNCTION {function}();"""
    )
def remove_append_only_trigger(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return

    table = schema_editor.quote_name("audit_auditevent")
    function = schema_editor.quote_name("audit_event_reject_mutation")
    trigger = schema_editor.quote_name("audit_event_immutable")
    schema_editor.execute(f"DROP TRIGGER IF EXISTS {trigger} ON {table};")
    schema_editor.execute(f"DROP FUNCTION IF EXISTS {function}();")


class Migration(migrations.Migration):
    dependencies = [("audit", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="auditevent",
            name="actor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.PROTECT,
                related_name="audit_events",
                to="auth.user",
            ),
        ),
        migrations.RunPython(install_append_only_trigger, remove_append_only_trigger),
    ]
