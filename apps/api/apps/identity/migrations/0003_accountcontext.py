import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity', '0002_alter_themepreference_theme'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AccountContext',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('patient', 'Patient'), ('professional', 'Professionnel'), ('establishment', 'Établissement')], max_length=24)),
                ('is_active', models.BooleanField(default=False)),
                ('onboarding_completed', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='account_contexts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('role',),
                'constraints': [models.UniqueConstraint(fields=('user', 'role'), name='unique_user_context_role')],
            },
        ),
    ]
