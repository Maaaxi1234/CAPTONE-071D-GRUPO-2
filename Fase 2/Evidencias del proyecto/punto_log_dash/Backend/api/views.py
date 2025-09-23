from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import generics

from .models import Category, Product, Order
from .serializers import CategorySerializer, ProductSerializer, OrderCreateSerializer, OrderSerializer

class MeView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        u = request.user
        return Response({"id": u.id, "username": u.username, "email": u.email})

class CategoryListView(generics.ListAPIView):
    queryset = Category.objects.order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]

class ProductListView(generics.ListAPIView):
    queryset = Product.objects.select_related("category").order_by("name")
    serializer_class = ProductSerializer
    permission_classes = [AllowAny]

class OrderCreateView(generics.CreateAPIView):
    serializer_class = OrderCreateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        out = OrderSerializer(order).data
        return Response(out, status=201)
