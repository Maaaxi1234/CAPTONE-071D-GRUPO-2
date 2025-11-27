"""
Vistas de inventario: categorías, productos, alertas, cuidados.
Usan modelos en api.models y serializers locales.
"""

from django.db.models.deletion import ProtectedError
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import generics, filters
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import Category, Product, Alert, PlantCare
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    AlertSerializer,
    PlantCareSerializer,
)
from api.perms import group_perm
from api.alerts import evaluar_alertas_producto, evaluar_alertas_pendientes


class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name"]

    def get_permissions(self):
        if self.request.method == "POST":
            return [group_perm("admin", "bodeguero")()]
        return super().get_permissions()


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "DELETE"):
            return [group_perm("admin", "bodeguero")()]
        return super().get_permissions()


class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "sku"]
    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method == "POST":
            return [group_perm("admin", "bodeguero")()]
        return super().get_permissions()

    def get_serializer_context(self):
        return {"request": self.request}


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        if self.request.method in ("PATCH", "PUT", "DELETE"):
            return [group_perm("admin", "bodeguero")()]
        return super().get_permissions()

    def get_serializer_context(self):
        return {"request": self.request}

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=204)
        except ProtectedError:
            return Response({"detail": "No se puede eliminar este producto porque tiene ventas asociadas."}, status=409)


class ProductWaterView(APIView):
    """Registra un riego y limpia alertas pendientes de ese tipo."""

    permission_classes = [group_perm("admin", "bodeguero")]

    def post(self, request, pk):
        producto = get_object_or_404(Product, pk=pk)
        producto.ultima_fecha_riego = timezone.now()
        producto.save(update_fields=["ultima_fecha_riego"])
        PlantCare.objects.create(
            producto=producto,
            tipo_accion="RIEGO",
            usuario=request.user if request.user.is_authenticated else None,
            observaciones=request.data.get("observaciones", ""),
        )
        producto.alertas.filter(tipo="RIEGO", resuelta=False).update(
            resuelta=True,
            fecha_resolucion=timezone.now(),
        )
        evaluar_alertas_producto(producto)
        return Response({"detail": "Riego registrado."}, status=201)


class ProductExtendLifeView(APIView):
    """Permite reiniciar la vida útil de un producto tras aplicar acciones correctivas."""

    permission_classes = [group_perm("admin", "bodeguero")]

    def post(self, request, pk):
        producto = get_object_or_404(Product, pk=pk)
        pendientes_riego = list(
            producto.alertas.filter(tipo="RIEGO", resuelta=False).values("mensaje", "nivel")
        )
        pendientes_sobrestock = list(
            producto.alertas.filter(tipo="SOBRESTOCK", resuelta=False).values("mensaje", "nivel")
        )
        producto.fecha_ingreso = timezone.now()
        producto.save(update_fields=["fecha_ingreso"])
        PlantCare.objects.create(
            producto=producto,
            tipo_accion="EXTENDER_VIDA",
            usuario=request.user if request.user.is_authenticated else None,
            observaciones=request.data.get("observaciones", "") or "Extensión de vida útil manual",
        )
        producto.alertas.filter(tipo="VIDA_UTIL", resuelta=False).update(
            resuelta=True,
            fecha_resolucion=timezone.now(),
        )
        evaluar_alertas_producto(producto)
        for data in pendientes_riego:
            Alert.objects.create(
                producto=producto,
                tipo="RIEGO",
                mensaje=data.get("mensaje", f"La planta '{producto.name}' está atrasada en riego."),
                nivel=data.get("nivel", "ADVERTENCIA"),
            )
        for data in pendientes_sobrestock:
            Alert.objects.create(
                producto=producto,
                tipo="SOBRESTOCK",
                mensaje=data.get("mensaje", f"'{producto.name}' lleva demasiado tiempo en vitrina."),
                nivel=data.get("nivel", "ADVERTENCIA"),
            )
        return Response({"detail": "Vida útil reiniciada para este producto."}, status=201)


class AlertListView(generics.ListAPIView):
    queryset = Alert.objects.select_related("producto").order_by("-fecha_creacion")
    serializer_class = AlertSerializer
    permission_classes = [group_perm("admin", "bodeguero", "vendedor")]
    filter_backends = [filters.SearchFilter]
    search_fields = ["mensaje", "producto__name", "producto__sku"]

    def get_queryset(self):
        evaluar_alertas_pendientes()
        qs = super().get_queryset()
        tipo = self.request.query_params.get("tipo")
        resuelta = self.request.query_params.get("resuelta")
        if tipo:
            qs = qs.filter(tipo=tipo)
        if resuelta is not None:
            qs = qs.filter(resuelta=resuelta.lower() in ("1", "true", "t", "yes"))
        return qs


class PlantCareListView(generics.ListAPIView):
    serializer_class = PlantCareSerializer
    permission_classes = [group_perm("admin", "bodeguero", "vendedor")]

    def get_queryset(self):
        qs = PlantCare.objects.select_related("producto", "usuario").order_by("-fecha_accion")
        product_id = self.request.query_params.get("producto")
        if product_id:
            qs = qs.filter(producto_id=product_id)
        return qs


__all__ = [
    "CategoryListCreateView",
    "CategoryDetailView",
    "ProductListCreateView",
    "ProductDetailView",
    "ProductWaterView",
    "ProductExtendLifeView",
    "AlertListView",
    "PlantCareListView",
]
