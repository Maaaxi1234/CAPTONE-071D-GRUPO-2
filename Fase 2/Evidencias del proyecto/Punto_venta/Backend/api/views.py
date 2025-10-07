from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from .perms import group_perm
from rest_framework.views import APIView
from rest_framework import generics, filters
from rest_framework.parsers import MultiPartParser, FormParser
from django.db.models.deletion import ProtectedError

from .models import Category, Product, Order
from .serializers import (
    CategorySerializer,
    ProductSerializer,
    OrderSerializer,
    OrderCreateSerializer,
)

# ---------- Usuario ----------
class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u = request.user
        groups = list(u.groups.values_list("name", flat=True))
        role = groups[0] if groups else "user"
        return Response({"id": u.id, "username": u.username, "email": u.email, "groups": groups, "role": role})

# ---------- Categorías ----------
class CategoryListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method in ("POST",):
            return [group_perm("admin","bodeguero")()]
        return [IsAuthenticatedOrReadOnly()]
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    def get_permissions(self):
        if self.request.method in ("POST",):
            return [group_perm("admin","bodeguero")()]
        return [IsAuthenticatedOrReadOnly()]
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

# ---------- Productos ----------
class ProductListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedOrReadOnly]
    def get_permissions(self):
        if self.request.method in ("POST",):
            return [group_perm("admin","bodeguero")()]
        return super().get_permissions()
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "sku"]
    if hasattr(Product, "barcode"):
        search_fields.append("barcode")

    # ⚠️ necesario para subir imagen en POST
    parser_classes = [MultiPartParser, FormParser]

    # ✅ pasa request al serializer (URLs absolutas de imagen)
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    def get_permissions(self):
        if self.request.method in ("PATCH","PUT","DELETE"):
            return [group_perm("admin","bodeguero")()]
        return [IsAuthenticatedOrReadOnly()]
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    # pasa request al serializer (URLs absolutas en PATCH/GET)
    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=204)
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar este producto porque tiene ventas asociadas."},
                status=409
            )

# ---------- Órdenes ----------
class OrderCreateView(generics.CreateAPIView):
    permission_classes = [group_perm("admin","vendedor")]
    serializer_class = OrderCreateSerializer

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = s.save()
        # ✅ pasa request para consistencia (si luego agregas imágenes)
        return Response(OrderSerializer(order, context={"request": request}).data, status=201)

class OrderListView(generics.ListAPIView):
    queryset = Order.objects.order_by("-created_at").prefetch_related("items__product")
    serializer_class = OrderSerializer
    permission_classes = [group_perm("admin","vendedor")]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

class OrderDetailView(generics.RetrieveAPIView):
    queryset = Order.objects.prefetch_related("items__product")
    serializer_class = OrderSerializer
    permission_classes = [group_perm("admin","vendedor")]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx
