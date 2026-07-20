# Generated manually for session limits + disconnect tracking

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("connections", "0005_gatewaydevice_gateway_lan_ip_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="connectionrequest",
            name="session_minutes",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="connectionrequest",
            name="session_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="connectionrequest",
            name="disconnected_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="connectionrequest",
            name="disconnect_reason",
            field=models.CharField(blank=True, max_length=32),
        ),
    ]
