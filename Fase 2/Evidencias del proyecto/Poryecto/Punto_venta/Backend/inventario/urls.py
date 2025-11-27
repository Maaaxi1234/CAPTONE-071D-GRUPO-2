from django.urls import path
from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    ProductListCreateView,
    ProductDetailView,
    ProductWaterView,
    ProductExtendLifeView,
    AlertListView,
    PlantCareListView,
)

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view()),
    path("categories/<int:pk>/", CategoryDetailView.as_view()),
    path("products/", ProductListCreateView.as_view()),
    path("products/<str:pk>/", ProductDetailView.as_view()),
    path("products/<str:pk>/regar/", ProductWaterView.as_view()),
    path("products/<str:pk>/extender-vida/", ProductExtendLifeView.as_view()),
    path("alerts/", AlertListView.as_view()),
    path("cuidados/", PlantCareListView.as_view()),
]
