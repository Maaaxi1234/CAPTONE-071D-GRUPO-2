from django.urls import path
from .views import (
    MeView,
    CategoryListCreateView, CategoryDetailView,
    ProductListCreateView, ProductDetailView,
    OrderCreateView, OrderListView, OrderDetailView,
)

urlpatterns = [
    path("me/", MeView.as_view()),
    # Categorías (IDs enteros)
    path("categories/", CategoryListCreateView.as_view()),
    path("categories/<int:pk>/", CategoryDetailView.as_view()),

    # Productos (IDs alfanuméricos -> usar <str:pk>)
    path("products/", ProductListCreateView.as_view()),
    path("products/<str:pk>/", ProductDetailView.as_view()),   # <= aquí el cambio

    # Órdenes (IDs enteros)
    path("orders/", OrderCreateView.as_view()),
    path("orders/list/", OrderListView.as_view()),
    path("orders/<int:pk>/", OrderDetailView.as_view()),
]
