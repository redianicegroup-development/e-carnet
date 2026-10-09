import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('care', '0001_initial'),
        ('patients', '0002_alter_patientprofile_options'),
    ]

    operations = [
        migrations.CreateModel(
            name='AccessGrant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('professional_name', models.CharField(max_length=180)),
                ('facility_label', models.CharField(max_length=180)),
                ('scope', models.JSONField(default=list)),
                ('status', models.CharField(choices=[('pending', 'En attente'), ('active', 'Active'), ('refused', 'Refusée'), ('expired', 'Expirée'), ('revoked', 'Révoquée')], default='pending', max_length=16)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('starts_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('extension_count', models.PositiveSmallIntegerField(default=0)),
                ('revoked_at', models.DateTimeField(blank=True, null=True)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_grants', to='patients.patientprofile')),
            ],
            options={
                'ordering': ('-requested_at',),
            },
        ),
        migrations.CreateModel(
            name='Consultation',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('professional_name', models.CharField(max_length=180)),
                ('facility_label', models.CharField(max_length=180)),
                ('reason', models.CharField(max_length=240)),
                ('observations', models.TextField(blank=True, max_length=4000)),
                ('conclusion', models.TextField(blank=True, max_length=4000)),
                ('care_plan', models.TextField(blank=True, max_length=4000)),
                ('validated_at', models.DateTimeField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('patient', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consultations', to='patients.patientprofile')),
            ],
            options={
                'ordering': ('-validated_at',),
            },
        ),
    ]
