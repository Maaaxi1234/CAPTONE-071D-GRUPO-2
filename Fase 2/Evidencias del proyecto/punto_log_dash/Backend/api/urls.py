from django.urls import path
from .views import MeView, CategoryListView, ProductListView, OrderCreateView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("categories/", CategoryListView.as_view(), name="categories"),
    path("products/", ProductListView.as_view(), name="products"),
    path("orders/", OrderCreateView.as_view(), name="orders"),
]
