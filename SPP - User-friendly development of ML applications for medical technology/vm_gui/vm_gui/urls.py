from django.contrib import admin
from django.urls import path, re_path, include 
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Hier wird die API eingebunden (falls deine App 'backend' heißt)
    path('api/', include('backend.urls')), 
    
    # Catch-All: Alles andere geht an React (index.html)
    re_path(r'^.*$', TemplateView.as_view(template_name='index.html')),
]