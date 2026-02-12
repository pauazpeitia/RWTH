from django.urls import path
from .api.templates import list_templates_endpoint, get_template_details_endpoint
from .api import workflows 

urlpatterns = [
    # GET /api/templates/
    path('templates/', list_templates_endpoint, name='list_templates'),

    # GET /api/templates/details/?name=...
    path('templates/details/', get_template_details_endpoint, name='template_details'),

    # POST /api/workflows/
    path('workflows/', workflows.submit_workflow, name='submit_workflow'),
]