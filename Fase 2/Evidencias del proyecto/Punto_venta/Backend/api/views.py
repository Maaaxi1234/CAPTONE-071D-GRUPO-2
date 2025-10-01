from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import generics, filters

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
        return Response({ "id": u.id, "username": u.username, "email": u.email })

# ---------- Categorías (GET + POST + PUT/PATCH + DELETE) ----------
class CategoryListCreateView(generics.ListCreateAPIView):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]  # lectura pública, escritura con login

class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

# ---------- Productos (GET + POST + PATCH + DELETE) ----------
class ProductListCreateView(generics.ListCreateAPIView):
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    # búsqueda opcional: ?search=monstera o ?search=sku123
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "sku"]
    if hasattr(Product, "barcode"):
        search_fields.append("barcode")

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

# ---------- Órdenes ----------
class OrderCreateView(generics.CreateAPIView):
    serializer_class = OrderCreateSerializer
    permission_classes = [AllowAny]  # ajusta a IsAuthenticated si quieres

    def create(self, request, *args, **kwargs):
        s = self.get_serializer(data=request.data)
        s.is_valid(raise_exception=True)
        order = s.save()
        return Response(OrderSerializer(order).data, status=201)

class OrderListView(generics.ListAPIView):
    queryset = Order.objects.order_by("-created_at").prefetch_related("items__product")
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

class OrderDetailView(generics.RetrieveAPIView):
    queryset = Order.objects.prefetch_related("items__product")
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]
