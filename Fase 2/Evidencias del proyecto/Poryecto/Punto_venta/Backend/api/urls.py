# Backend/api/urls.py
from django.urls import path
from .views import MeView

# Ruta para obtener datos del usuario autenticado.
urlpatterns = [
    path("me/", MeView.as_view()),
]
