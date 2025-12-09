"""
Vistas POS (órdenes), usando modelos en api.models y serializers locales.
"""

from rest_framework import generics
from rest_framework.response import Response

from api.models import Order
from .serializers import OrderSerializer, OrderCreateSerializer
from api.perms import group_perm

PAID = {"status": "paid"}


# Endpoint para crear una orden (POST). Valida con OrderCreateSerializer.
class OrderCreateView(generics.CreateAPIView):
    permission_classes = [group_perm("admin", "vendedor")]
    serializer_class = OrderCreateSerializer

    def create(self, request, *args, **kwargs):
        # Valida y guarda la orden; devuelve representación completa.
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = s.save()
        return Response(OrderSerializer(order, context={"request": request}).data, status=201)


# Lista de órdenes (solo lecturas), ordenadas por fecha.
class OrderListView(generics.ListAPIView):
    queryset = Order.objects.order_by("-created_at").prefetch_related("items__product")
    serializer_class = OrderSerializer
    permission_classes = [group_perm("admin", "vendedor")]

    def get_serializer_context(self):
        return {"request": self.request}


# Detalle de una orden por PK.
class OrderDetailView(generics.RetrieveAPIView):
    queryset = Order.objects.prefetch_related("items__product")
    serializer_class = OrderSerializer
    permission_classes = [group_perm("admin", "vendedor")]

    def get_serializer_context(self):
        return {"request": self.request}


__all__ = ["OrderCreateView", "OrderListView", "OrderDetailView"]
