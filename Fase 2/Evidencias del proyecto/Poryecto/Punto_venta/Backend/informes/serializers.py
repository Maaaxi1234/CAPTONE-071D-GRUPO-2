"""
Serializers para Informes/KPIs.
Se definen aquí para mantener el módulo independiente de api.serializers.
"""

from rest_framework import serializers


# Representa un valor KPI sencillo (label + value, opcional porcentaje/monto).
class KPIValueSerializer(serializers.Serializer):
    label = serializers.CharField()
    value = serializers.FloatField()
    porcentaje = serializers.FloatField(required=False)
    monto = serializers.FloatField(required=False)


# Totales principales (ventas/tickets/items).
class KPITotalesSerializer(serializers.Serializer):
    total_ventas = serializers.FloatField()
    tickets = serializers.IntegerField()
    total_items = serializers.IntegerField()
    ticket_promedio = serializers.FloatField()


# Punto de serie (x,y) para gráficos.
class SeriesPointSerializer(serializers.Serializer):
    x = serializers.CharField()  # fecha o 'YYYY-MM'
    y = serializers.FloatField()


__all__ = ["KPIValueSerializer", "KPITotalesSerializer", "SeriesPointSerializer"]
